// 首页仪表盘
var auth = require('../../utils/auth');
var api = require('../../utils/api');

Page({
  data: {
    user: null,
    stats: { materialCount: 0, totalAvailable: 0, unreturnedCount: 0, dutyCount: 0, checkinCount: 0 },
    recentRecords: [],
    weekDuties: []
  },

  onShow: function () {
    if (!auth.requireLogin()) return;
    var u = auth.getCurrentUser();
    this.setData({ user: u });
    this.loadData();
  },

  loadData: function () {
    var that = this;
    Promise.all([
      api.getMaterialSummary(),
      api.getUnreturnedCount(),
      api.getDutyCount(),
      api.getCheckinCount(),
      api.getRecentBorrowRecords(5),
      api.getDuties()
    ]).then(function (results) {
      var summary = results[0].data || {};
      var unret = results[1].data || {};
      var dutyCnt = results[2].data || {};
      var ckCnt = results[3].data || {};

      var records = (results[4].data || []).map(function (r) {
        return {
          id: r.id, userName: r.user_name, materialName: r.material_name,
          borrowNum: r.borrow_num, borrowTime: r.borrow_time, status: r.status
        };
      });

      var duties = (results[5].data || []).map(function (d) {
        return {
          id: d.id, date: d.date, weekday: d.weekday,
          startTime: d.start_time, endTime: d.end_time,
          dutyPerson: d.duty_person, location: d.location
        };
      });

      that.setData({
        stats: {
          materialCount: summary.materialCount || 0,
          totalAvailable: summary.totalAvailable || 0,
          unreturnedCount: unret.count || 0,
          dutyCount: dutyCnt.count || 0,
          checkinCount: ckCnt.count || 0
        },
        recentRecords: records,
        weekDuties: duties
      });
    }).catch(function () {});
  },

  onLogout: function () { auth.logout(); },
  onGoUsers: function () {
    wx.navigateTo({ url: '/pages/users/index' });
  }
});