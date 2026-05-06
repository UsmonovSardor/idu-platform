// =============================================
// API CLIENT
// =============================================

var API_BASE = '/api';
var _apiToken = null;

function setToken(token) {
  _apiToken = token;
}

function getToken() {
  return _apiToken;
}

async function api(method, path, body) {
   var token = _apiToken || localStorage.getItem('idu_token') || localStorage.getItem('token') || localStorage.getItem('authToken');
    var headers = { 'Content-Type': 'application/json' };
if (token) headers['Authorization'] = 'Bearer ' + token;
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
