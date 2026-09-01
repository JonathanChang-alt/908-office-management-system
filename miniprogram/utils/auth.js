// 认证工具模块
var TOKEN_KEY = 'token';
var USER_KEY = 'currentUser';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token);
}

function getCurrentUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setCurrentUser(user) {
  if (!user) {
    wx.removeStorageSync(USER_KEY);
    return;
  }
  wx.setStorageSync(USER_KEY, {
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
    openid: user.openid
  });
}

function isLoggedIn() {
  return !!wx.getStorageSync(TOKEN_KEY);
}

function isAdmin() {
  var user = getCurrentUser();
  if (!user) return false;
  return user.role === 'admin';
}

function isStaff() {
  var user = getCurrentUser();
  if (!user) return false;
  return user.role === 'staff' || user.role === 'admin';
}

function logout() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.reLaunch({ url: '/pages/login/index' });
}

function requireLogin() {
  if (!isLoggedIn()) {
    wx.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!isAdmin()) {
    wx.showToast({ title: '仅管理员可操作', icon: 'none' });
    return false;
  }
  return true;
}

module.exports = {
  getToken: getToken,
  setToken: setToken,
  getCurrentUser: getCurrentUser,
  setCurrentUser: setCurrentUser,
  isLoggedIn: isLoggedIn,
  isAdmin: isAdmin,
  isStaff: isStaff,
  logout: logout,
  requireLogin: requireLogin,
  requireAdmin: requireAdmin
};