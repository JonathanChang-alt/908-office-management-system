// pages/login/index.js
var api = require('../../utils/api');
var auth = require('../../utils/auth');

Page({
  data: {
    name: '',
    loading: false
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value });
  },

  onLogin: function () {
    var that = this;
    var name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入真实姓名', icon: 'none' });
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...', mask: true });

    wx.login({
      success: function (loginRes) {
        if (!loginRes.code) {
          wx.hideLoading();
          that.setData({ loading: false });
          wx.showToast({ title: '获取微信凭证失败', icon: 'none' });
          return;
        }
        console.log('[登录] code:', loginRes.code.substring(0, 6) + '...');

        api.wechatLogin({ code: loginRes.code, name: name }).then(function (res) {
          wx.hideLoading();
          that.setData({ loading: false });
          var data = res.data || {};
          auth.setToken(data.token);
          var u = data.user;
          auth.setCurrentUser({
            id: u.id,
            name: u.name,
            role: u.role,
            status: u.status,
            openid: u.openid
          });
          console.log('[登录] 成功:', u.name, u.role, u.status);

          if (u.status === 'active') {
            wx.switchTab({ url: '/pages/index/index' });
          } else {
            wx.showToast({ title: '登录成功，等待管理员审核', icon: 'none', duration: 3000 });
          }
        }).catch(function (err) {
          wx.hideLoading();
          that.setData({ loading: false });
          var msg = err.message || '登录失败';
          console.error('[登录] 失败:', msg);
          if (msg.indexOf('pending') !== -1 || msg.indexOf('approval') !== -1) {
            wx.showModal({
              title: '等待审核',
              content: '已提交申请，请等待管理员审核通过后使用。',
              showCancel: false
            });
          } else if (msg.indexOf('disabled') !== -1) {
            wx.showModal({
              title: '账号已禁用',
              content: '您的账号已被禁用，请联系管理员。',
              showCancel: false
            });
          } else {
            wx.showToast({ title: msg, icon: 'none', duration: 3000 });
          }
        });
      },
      fail: function (err) {
        wx.hideLoading();
        that.setData({ loading: false });
        console.error('[登录] wx.login失败:', err);
        wx.showToast({ title: '微信登录失败，请重试', icon: 'none' });
      }
    });
  }
});