# System bridge: with no args, prints one JSON line per second (media + foreground app).
# With -Cmd toggle|next|prev, sends that media command and exits.
param([string]$Cmd, [int]$Parent)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [type]$t) {
  $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result
}

# -Cmd locate: one position from Windows' own location service (needs Settings > Privacy > Location on)
if ($Cmd -eq 'locate') {
  try {
    $null = [Windows.Devices.Geolocation.Geolocator, Windows.Devices.Geolocation, ContentType = WindowsRuntime]
    $access = Await ([Windows.Devices.Geolocation.Geolocator]::RequestAccessAsync()) ([Windows.Devices.Geolocation.GeolocationAccessStatus])
    if ($access -ne 'Allowed') { [Console]::Out.WriteLine((@{ error = "location $access" } | ConvertTo-Json -Compress)); exit }
    $loc = New-Object Windows.Devices.Geolocation.Geolocator
    $loc.DesiredAccuracy = 'Default'
    $p = (Await ($loc.GetGeopositionAsync()) ([Windows.Devices.Geolocation.Geoposition])).Coordinate.Point.Position
    [Console]::Out.WriteLine((@{ lat = [math]::Round($p.Latitude, 3); lon = [math]::Round($p.Longitude, 3) } | ConvertTo-Json -Compress))
  } catch { [Console]::Out.WriteLine((@{ error = 'location unavailable' } | ConvertTo-Json -Compress)) }
  exit
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
  ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

if ($Cmd) {
  $s = $mgr.GetCurrentSession()
  if ($s) {
    $op = switch ($Cmd) {
      'toggle' { $s.TryTogglePlayPauseAsync() }
      'next'   { $s.TrySkipNextAsync() }
      'prev'   { $s.TrySkipPreviousAsync() }
    }
    if ($op) { $null = Await $op ([bool]) }
  }
  exit
}

Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public static class Wins {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  // Windows that show in the taskbar: visible, titled, not owned, not tool windows, not cloaked (hidden UWP)
  public static List<KeyValuePair<uint, string>> List() {
    var r = new List<KeyValuePair<uint, string>>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero || (GetWindowLong(h, -20) & 0x80) != 0) return true;
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      var sb = new StringBuilder(512); GetWindowText(h, sb, 512); if (sb.Length == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); r.Add(new KeyValuePair<uint, string>(pid, sb.ToString()));
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
public static class Fg {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string Title() { var sb = new StringBuilder(512); GetWindowText(GetForegroundWindow(), sb, 512); return sb.ToString(); }
  public static uint Pid() { uint p; GetWindowThreadProcessId(GetForegroundWindow(), out p); return p; }
}
'@

$null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime]
$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
$notifType = [System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]]
$seen = $null # first pass only records existing notifications so old ones don't replay
function Read-Notifs {
  $list = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) $notifType
  $fresh = @()
  $ids = @{}
  foreach ($n in $list) {
    $ids[$n.Id] = 1
    if ($null -ne $script:seen -and -not $script:seen.ContainsKey($n.Id)) {
      $texts = @()
      try {
        $b = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
        if ($b) { $texts = @($b.GetTextElements() | ForEach-Object { $_.Text }) }
      } catch {}
      $fresh += @{ type = 'notif'; id = $n.Id; app = $n.AppInfo.DisplayInfo.DisplayName
                   title = $texts[0]; body = ($texts | Select-Object -Skip 1) -join "`n" }
    }
  }
  $script:seen = $ids
  $fresh
}

Add-Type -AssemblyName System.Drawing
$icons = @{}     # exe path -> data URL, sent to the UI once per path
$procInfo = @{}  # pid -> name/path/description cache
$lastApps = ''
$skip = '^(TextInputHost|ShellExperienceHost|SearchHost|StartMenuExperienceHost|LockApp|SystemSettingsBroker)$'
function Read-Apps {
  $fgPid = [Fg]::Pid()
  $apps = foreach ($w in [Wins]::List()) {
    $id = $w.Key
    if (-not $procInfo.ContainsKey($id)) {
      try { $p = Get-Process -Id $id; $procInfo[$id] = @{ name = $p.ProcessName; path = $p.Path; desc = $p.Description } }
      catch { $procInfo[$id] = @{ name = ''; path = $null; desc = '' } }
    }
    $i = $procInfo[$id]
    if (-not $i.name -or $i.name -match $skip -or ($i.name -eq 'explorer' -and $w.Value -eq 'Program Manager') -or ($Parent -and $id -eq $Parent)) { continue }
    @{ pid = $id; name = $i.name; desc = $i.desc; title = $w.Value; path = $i.path; fg = ($id -eq $fgPid) }
  }
  $json = (@($apps) | ConvertTo-Json -Compress -Depth 3)
  if ($json -eq $script:lastApps) { return $null } # unchanged -> send nothing
  $script:lastApps = $json
  $newIcons = @{}
  foreach ($a in $apps) {
    if ($a.path -and -not $icons.ContainsKey($a.path)) {
      $icons[$a.path] = ''
      try {
        $bmp = [System.Drawing.Icon]::ExtractAssociatedIcon($a.path).ToBitmap()
        $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $icons[$a.path] = 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray())
        $newIcons[$a.path] = $icons[$a.path]
      } catch {}
    }
  }
  @{ type = 'apps'; apps = @($apps); icons = $newIcons }
}

# --- Connected devices: external USB devices (not built into the laptop) and connected Bluetooth devices ---
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$devColl = [Windows.Devices.Enumeration.DeviceInformationCollection]
$btSel = [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromConnectionStatus('Connected')
$leSel = [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromConnectionStatus('Connected')
$MACHINE = '{00000000-0000-0000-ffff-ffffffffffff}' # container of everything built into the laptop
$devInfo = @{}   # instance id -> @{ container; name } (doesn't change while plugged in)
$btKind = @{}    # bluetooth id -> kind
$lastDevices = $null
$RANK = @{ phone = 1; headphones = 2; speaker = 3; controller = 4; mouse = 5; keyboard = 6; storage = 7; usb = 8; bluetooth = 9 }

function Kind-FromBluetooth($id, [bool]$le) {
  if ($btKind.ContainsKey($id)) { return $btKind[$id] }
  $k = 'bluetooth'
  try {
    if ($le) {
      $d = Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
      if ($d.Appearance.Category -eq 15) { $k = @{ 1 = 'keyboard'; 2 = 'mouse'; 3 = 'controller'; 4 = 'controller' }[[int]$d.Appearance.SubCategory]; if (-not $k) { $k = 'bluetooth' } }
    } else {
      $d = Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($id)) ([Windows.Devices.Bluetooth.BluetoothDevice])
      # Minor class names overlap across device types (audio headsets read as "ToyRobot"), so use the raw numbers
      $major = "$($d.ClassOfDevice.MajorClass)"; $minor = [int]$d.ClassOfDevice.MinorClass
      if ($major -eq 'Phone') { $k = 'phone' }
      elseif ($major -eq 'AudioVideo') { $k = if ($minor -in 5, 7, 8, 10) { 'speaker' } else { 'headphones' } } # 1 headset, 2 hands-free, 6 headphones
      elseif ($major -eq 'Peripheral') {
        $k = if ($minor -band 0x10) { 'keyboard' } elseif ($minor -band 0x20) { 'mouse' } elseif (($minor -band 0x0F) -in 1, 2) { 'controller' } else { 'bluetooth' }
      }
    }
  } catch {}
  $btKind[$id] = $k; $k
}

function Read-Devices {
  $out = @{}
  # Bluetooth: Windows says exactly what kind of device it is
  foreach ($pair in @(@($btSel, $false), @($leSel, $true))) {
    try {
      foreach ($d in (Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($pair[0])) $devColl)) {
        if (-not $d.Name) { continue }
        $k = Kind-FromBluetooth $d.Id $pair[1]
        # dual-mode devices show up twice (classic + Low Energy); never let a vaguer entry replace a specific one
        if ($out.ContainsKey('bt:' + $d.Name) -and $k -eq 'bluetooth') { continue }
        $out['bt:' + $d.Name] = @{ id = 'bt:' + $d.Name; kind = $k; name = $d.Name; via = 'bt' }
      }
    } catch {}
  }
  # USB: devices present right now, minus everything that is part of the laptop itself (its keyboard, webcam… are USB too)
  $pnp = Get-CimInstance Win32_PnPEntity -Filter "Present=True AND (PNPClass='Mouse' OR PNPClass='Keyboard' OR PNPClass='WPD' OR PNPClass='MEDIA' OR PNPClass='HIDClass' OR PNPClass='DiskDrive')"
  foreach ($p in $pnp) {
    $id = $p.PNPDeviceID
    if ($id -notmatch '^(USB|HID)\\VID_|^USBSTOR\\|^SWD\\WPDBUSENUM') { continue } # Bluetooth ones are covered above
    $kind = switch ($p.PNPClass) {
      'Mouse' { 'mouse' } 'Keyboard' { 'keyboard' } 'DiskDrive' { 'storage' }
      'WPD' { if ($id -like 'USB\*') { 'phone' } else { 'storage' } }
      'MEDIA' { 'headphones' }
      'HIDClass' { if ($p.Name -match 'game controller') { 'controller' } else { $null } }
    }
    if (-not $kind) { continue }
    if (-not $devInfo.ContainsKey($id)) {
      $c = $null; $n = $null
      try { $c = "$((Get-PnpDeviceProperty -InstanceId $id -KeyName DEVPKEY_Device_ContainerId).Data)".ToLower() } catch {}
      try {
        $parent = (Get-PnpDeviceProperty -InstanceId $id -KeyName DEVPKEY_Device_Parent).Data
        $n = (Get-PnpDeviceProperty -InstanceId $parent -KeyName DEVPKEY_Device_BusReportedDeviceDesc).Data
      } catch {}
      $devInfo[$id] = @{ container = $c; name = $(if ($n) { $n } else { $p.Name }) }
    }
    $i = $devInfo[$id]
    if (-not $i.container -or $i.container -eq $MACHINE) { continue }
    $key = 'usb:' + $i.container # one icon per physical device; its most specific part decides the icon
    if (-not $out.ContainsKey($key) -or $RANK[$kind] -lt $RANK[$out[$key].kind]) { $out[$key] = @{ id = $key; kind = $kind; name = $i.name; via = 'usb' } }
  }
  $list = @($out.Values | Sort-Object { $_.id })
  $json = ConvertTo-Json -Compress -Depth 3 -InputObject $list
  if ($json -eq $script:lastDevices) { return $null }
  $script:lastDevices = $json
  @{ type = 'devices'; devices = $list }
}

# Windows signals every plug/unplug and Bluetooth connect/disconnect; rescan right away instead of waiting for the slow poll
Register-WmiEvent -Query 'SELECT * FROM Win32_DeviceChangeEvent' -SourceIdentifier devchange | Out-Null
$tick = 0; $rescan = 0
while ($true) {
  try { $a = Read-Apps; if ($a) { [Console]::Out.WriteLine(($a | ConvertTo-Json -Compress -Depth 4)) } } catch {}
  $changed = @(Get-Event -SourceIdentifier devchange -ErrorAction SilentlyContinue)
  if ($changed.Count) { $changed | Remove-Event; $rescan = 2 } # scan now and once more next loop (Bluetooth status can trail the signal)
  if ($rescan -gt 0 -or $tick % 10 -eq 0) {
    if ($rescan -gt 0) { $rescan-- }
    try { $dv = Read-Devices; if ($dv) { [Console]::Out.WriteLine(($dv | ConvertTo-Json -Compress -Depth 4)) } } catch {}
  }
  $tick++
  if ($Parent -and -not (Get-Process -Id $Parent -ErrorAction SilentlyContinue)) { exit } # island closed -> stop
  try { foreach ($f in Read-Notifs) { [Console]::Out.WriteLine(($f | ConvertTo-Json -Compress)) } } catch {}
  $out = @{ type = 'sys'; media = $null; app = $null }
  try {
    $s = $mgr.GetCurrentSession()
    if ($s) {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $out.media = @{ title = $p.Title; artist = $p.Artist; source = $s.SourceAppUserModelId
                      status = $s.GetPlaybackInfo().PlaybackStatus.ToString() }
    }
  } catch {}
  try { $out.app = @{ name = (Get-Process -Id ([Fg]::Pid())).ProcessName; title = [Fg]::Title() } } catch {}
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 3))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
