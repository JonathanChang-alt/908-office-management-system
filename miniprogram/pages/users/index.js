// pages/users/index.js
var auth = require('../../utils/auth');
var api = require('../../utils/api');

Page({
  data: {
    users: [],
    loading: false
  },

  onShow: function () {
    if (!auth.requireLogin()) return;
    if (!auth.isAdmin()) {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    this.loadUsers();
  },

  loadUsers: function () {
    var that = this;
    this.setData({ loading: true });
    api.getUsers().then(function (res) {
      that.setData({ users: res.data || [], loading: false });
    }).catch(function (err) {
      that.setData({ loading: false });
      wx.showToast({ title: err.message, icon: 'none' });
    });
  },

  setRole: function (e) {
    var id = e.currentTarget.dataset.id;
    var role = e.currentTarget.dataset.role;
    this.doUpdate(id, { role: role, status: 'active' });
  },

  setStatus: function (e) {
    var id = e.currentTarget.dataset.id;
    var status = e.currentTarget.dataset.status;
    this.doUpdate(id, { status: status });
  },

  doUpdate: function (id, data) {
    var that = this;
    wx.showLoading({ title: '更新中...' });
    api.updateUser(id, data).then(function () {
      wx.hideLoading();
      that.loadUsers();
    }).catch(function (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
    });
  }
});