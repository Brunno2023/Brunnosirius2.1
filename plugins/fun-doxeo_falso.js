import {performance} from 'perf_hooks';
const handler = async (m, {conn, text}) => {
    
const start = performance.now();    
const end = performance.now();
const executionTime = (end - start);
    
const ipParts = [];
for (let i = 0; i < 4; i++) {
ipParts.push(Math.floor(Math.random() * 256))};
const ipAddress = ipParts.join('.');
const fakeData = {
name_tag: '',
ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
fakeCameraLink: `http://${ipAddress}.com/camera-feed`,    
n: Math.floor(Math.random() * 100000),
w: (Math.random() * (20 - 10) + 10).toFixed(4),
ssNumber: Math.floor(Math.random() * 10000000000000000),
ipv6: `fe80:${(Math.random() * 65535).toString(16)}:${(Math.random() * 65535).toString(16)}:${(Math.random() * 65535).toString(16)}:${(Math.random() * 65535).toString(16)}%${Math.floor(Math.random() * 100)}`,
upnp: getRandomValue(['Enabled', 'Disabled']),
dmz: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
mac: `${Math.floor(Math.random() * 256).toString(16).toUpperCase()}:${Math.floor(Math.random() * 256).toString(16).toUpperCase()}:${Math.floor(Math.random() * 256).toString(16).toUpperCase()}:${Math.floor(Math.random() * 256).toString(16).toUpperCase()}:${Math.floor(Math.random() * 256).toString(16).toUpperCase()}:${Math.floor(Math.random() * 256).toString(16).toUpperCase()}`,
isp: getRandomValue(['Ucom universal', 'ISP Co', 'Internet Solutions Inc']),
dns: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
altDns: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
dnsSuffix: getRandomValue(['Dlink', 'DNS', 'ISPsuffix']),
wan: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
wanType: getRandomValue(['private nat', 'public nat', 'Dynamic IP']),
gateway: `192.${Math.floor(Math.random() * 256)}.0.1`,
subnetMask: `255.255.${Math.floor(Math.random() * 256)}.0`,
udpOpenPorts: `${Math.floor(Math.random() * 10000)}.${Math.floor(Math.random() * 10000)}`,
tcpOpenPorts: `${Math.floor(Math.random() * 10000)}`,
routerVendor: getRandomValue(['ERICCSON', 'TPLINK', 'Cisco']),
deviceVendor: getRandomValue(['WIN32-X', 'Device Co', 'SecureTech']),
connectionType: getRandomValue(['TPLINK COMPANY', 'ISP Connect', 'Home Network']),
icmphops: `192.${Math.floor(Math.random() * 256)}.0.1 192.${Math.floor(Math.random() * 256)}.1.1 100.${Math.floor(Math.random() * 256)}.43.4`,
  
