// app.js
var api = require('./utils/api');
var auth = require('./utils/auth');

App({
  onLaunch: function () {
    var token = wx.getStorageSync('token');
    var user = wx.getStorageSync('currentUser');

    if (!token || !user) {
      // No login, go to login page
      wx.reLaunch({ url: '/pages/login/index' });
      return;
    }

    // Verify token is still valid
    api.getMe().then(function (res) {
      var data = res.data || {};
      auth.setCurrentUser({
        id: data.id,
        name: data.name,
        role: data.role,
        status: data.status,
        openid: data.openid
      });
      console.log('[App] auto login ok:', data.name, data.role, data.status);
    }).catch(function (err) {
      console.log('[App] token invalid:', err.message);
      auth.logout();
    });
  },
  globalData: {}
});