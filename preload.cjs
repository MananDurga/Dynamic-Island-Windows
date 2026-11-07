const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('island', {
  onEvent: f => ipcRenderer.on('island', (_, ev) => f(ev)),
  getConfig: () => ipcRenderer.invoke('get_config'),
  locate: () => ipcRenderer.invoke('locate'),
  interactive: on => ipcRenderer.send('interactive', on),
  hitRect: () => {},
  media: cmd => ipcRenderer.send('media', cmd),
  menu: () => ipcRenderer.send('menu'),
  decide: (id, decision) => ipcRenderer.send('decide', id, decision),
});
