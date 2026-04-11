// =============================================
// API CLIENT
// =============================================

var API_BASE = 'https://idu-platform-production.up.railway.app/api';
var _apiToken = null;

function setToken(token) {
  _apiToken = token;
}

function getToken() {
  return _apiToken;
}

async function api(method, path, body) {
  var headers = { 'Content-Type': 'application/json' };
  if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;
  try {
    var res = await fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status, data: data });
    }
    return data;
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(new Error('Server bilan aloqa yo\'q'), { status: 0 });
  }
}
