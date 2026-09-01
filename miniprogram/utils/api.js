// API 请求封装
var PROD_BASE_URL = 'https://your-domain.example.com/api';
var DEV_BASE_URL = 'http://127.0.0.1:3001/api';
var USE_DEV_TUNNEL = true;

var BASE_URL = USE_DEV_TUNNEL ? DEV_BASE_URL : PROD_BASE_URL;

console.log('[API] BASE_URL:', BASE_URL);

function request(options) {
  var token = wx.getStorageSync('token') || '';
  var fullUrl = BASE_URL + options.url;
  return new Promise(function (resolve, reject) {
    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      success: function (res) {
        var data = res.data || {};
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('currentUser');
          wx.reLaunch({ url: '/pages/login/index' });
          reject(new Error('login expired'));
          return;
        }
        if (res.statusCode === 403) {
          reject(new Error(data.message || 'access denied'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(data.message || data.error || ('HTTP ' + res.statusCode)));
        }
      },
      fail: function (err) {
        console.error('[API] fail:', err.errMsg, fullUrl);
        reject(new Error(err.errMsg || 'network error'));
      }
    });
  });
}

// ---- 认证 ----
function wechatLogin(data) {
  return request({ url: '/auth/wechat-login', method: 'POST', data: data });
}
function getMe() {
  return request({ url: '/auth/me' });
}

// ---- 用户管理 ----
function getUsers() {
  return request({ url: '/users' });
}
function updateUser(id, data) {
  return request({ url: '/users/' + id, method: 'PUT', data: data });
}

// ---- 物资 ----
function getMaterials() { return request({ url: '/materials' }); }
function getMaterialSummary() { return request({ url: '/materials/stats/summary' }); }
function addMaterial(data) { return request({ url: '/materials', method: 'POST', data: data }); }
function updateMaterial(id, data) { return request({ url: '/materials/' + id, method: 'PUT', data: data }); }
function deleteMaterial(id) { return request({ url: '/materials/' + id, method: 'DELETE' }); }

// ---- 借还 ----
function getBorrowRecords() { return request({ url: '/borrow' }); }
function getUnreturnedRecords() { return request({ url: '/borrow/unreturned' }); }
function getRecentBorrowRecords(count) { return request({ url: '/borrow/recent/' + (count || 10) }); }
function getUnreturnedCount() { return request({ url: '/borrow/stats/unreturned' }); }
function borrowMaterial(data) { return request({ url: '/borrow/borrow', method: 'POST', data: data }); }
function returnMaterial(recordId, data) {
  return request({ url: '/borrow/return/' + recordId, method: 'POST', data: data || {} });
}
function updateBorrowComment(id, data) {
  return request({ url: '/borrow/' + id + '/comment', method: 'PATCH', data: data });
}

// ---- 值班 ----
function getDuties() { return request({ url: '/duty' }); }
function addDuty(data) { return request({ url: '/duty', method: 'POST', data: data }); }
function updateDuty(id, data) { return request({ url: '/duty/' + id, method: 'PUT', data: data }); }
function deleteDuty(id) {
  var user = wx.getStorageSync('currentUser') || {};
  return request({ url: '/duty/' + id, method: 'DELETE', data: { is_admin: user.role === 'admin' }});
}
function getDutyCount() { return request({ url: '/duty/stats/count' }); }

// ---- 打卡 ----
function getCheckins() { return request({ url: '/checkin' }); }
function getCheckinCount() { return request({ url: '/checkin/stats/count' }); }
function doCheckin(data) { return request({ url: '/checkin', method: 'POST', data: data }); }
function checkCheckin(dutyId, userName) { return request({ url: '/checkin/check/' + dutyId + '/' + encodeURIComponent(userName) }); }
function deleteCheckin(id) {
  var user = wx.getStorageSync('currentUser') || {};
  return request({ url: '/checkin/' + id, method: 'DELETE', data: { is_admin: user.role === 'admin' }});
}

module.exports = {
  wechatLogin: wechatLogin, getMe: getMe,
  getUsers: getUsers, updateUser: updateUser,
  getMaterials: getMaterials, getMaterialSummary: getMaterialSummary,
  addMaterial: addMaterial, updateMaterial: updateMaterial, deleteMaterial: deleteMaterial,
  getBorrowRecords: getBorrowRecords, getUnreturnedRecords: getUnreturnedRecords,
  getRecentBorrowRecords: getRecentBorrowRecords, getUnreturnedCount: getUnreturnedCount,
  borrowMaterial: borrowMaterial, returnMaterial: returnMaterial, updateBorrowComment: updateBorrowComment,
  getDuties: getDuties, addDuty: addDuty, updateDuty: updateDuty, deleteDuty: deleteDuty, getDutyCount: getDutyCount,
  getCheckins: getCheckins, getCheckinCount: getCheckinCount, doCheckin: doCheckin,
  checkCheckin: checkCheckin, deleteCheckin: deleteCheckin
};