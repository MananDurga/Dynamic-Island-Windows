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

while ($true) {
  try { $a = Read-Apps; if ($a) { [Console]::Out.WriteLine(($a | ConvertTo-Json -Compress -Depth 4)) } } catch {}
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
