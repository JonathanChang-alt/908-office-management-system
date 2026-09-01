var auth = require('../../utils/auth');
var api = require('../../utils/api');

Page({
  data: {
    activeTab: 0, duties: [], rawDuties: [], checkins: [], isAdmin: false,
    showModal: false, editMode: false, editId: null,
    formDate: '', formWeekday: '', formStart: '', formEnd: '', formPerson: '', formLocation: '908办公室',
    selectedDutyId: null, selectedDuty: null, checkinPerson: ''
  },

  onShow: function () {
    if (!auth.requireLogin()) return;
    var u = auth.getCurrentUser();
    var adm = auth.isAdmin(); console.log('[值班] 当前用户：', u ? u.name : '?', '是否管理员：', adm);
    this.setData({ isAdmin: adm, checkinPerson: u ? u.name : '' });
    this.loadAll();
  },

  loadAll: function () {
    var that = this;
    Promise.all([api.getDuties(), api.getCheckins()]).then(function (res) {
      var duties = (res[0].data||[]).map(function(d){
        return { id:d.id, date:d.date, weekday:d.weekday,
          startTime:d.start_time, endTime:d.end_time,
          dutyPerson:d.duty_person, location:d.location };
      });
      var cks = (res[1].data||[]).map(function(c){
        return { id:c.id, userName:c.user_name, dutyId:c.duty_id,
          checkinTime:c.checkin_time, status:c.status };
      });

      that.setData({ rawDuties: duties, checkins: cks });
      // 过滤已打卡的值班安排
      that.filterCheckedDuties();
    });
  },

  // 过滤已打卡值班（根据当前输入的打卡人）
  filterCheckedDuties: function () {
    var person = (this.data.checkinPerson||'').trim();
    var allDuties = this.data.rawDuties || [];
    var checkins = this.data.checkins || [];

    if (!person) {
      this.setData({ duties: allDuties });
      return;
    }

    var checkedIds = [];
    for (var i = 0; i < checkins.length; i++) {
      if (checkins[i].userName === person) {
        checkedIds.push(Number(checkins[i].dutyId));
      }
    }

    var filtered = allDuties.filter(function (d) {
      return checkedIds.indexOf(Number(d.id)) === -1;
    });

    this.setData({ duties: filtered });
  },

  switchTab: function(e) {
    this.setData({ activeTab: parseInt(e.currentTarget.dataset.index),
      selectedDutyId: null, selectedDuty: null });
  },

  selectDuty: function(e) {
    var id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    if (this.data.selectedDutyId === id) {
      this.setData({ selectedDutyId: null, selectedDuty: null });
    } else {
      var d = this.data.duties.find(function(x) { return Number(x.id) === id; });
      if (d) {
        this.setData({ selectedDutyId: id, selectedDuty: d });
        console.log('[值班] 已选择：', d.date, d.dutyPerson);
      }
    }
  },

  showAdd: function() {
    this.setData({ showModal: true, editMode: false, editId: null,
      formDate:'', formWeekday:'', formStart:'', formEnd:'', formPerson:'', formLocation:'908办公室' });
  },
  showEdit: function() {
    var d = this.data.selectedDuty;
    if (!d) { wx.showToast({ title:'请先选择值班安排', icon:'none' }); return; }
    this.setData({ showModal: true, editMode: true, editId: d.id,
      formDate: d.date, formWeekday: d.weekday,
      formStart: d.startTime, formEnd: d.endTime,
      formPerson: d.dutyPerson, formLocation: d.location });
  },
  closeModal: function() { this.setData({ showModal: false }); },
  noop: function () {},
  onFormField: function(e) { var field = e.currentTarget.dataset.field; if (!field) return; var o = {}; o[field] = e.detail.value; this.setData(o); },

  submitDuty: function() {
    var d=this.data.formDate.trim(), w=this.data.formWeekday.trim(),
        s=this.data.formStart.trim(), e=this.data.formEnd.trim(),
        p=this.data.formPerson.trim(), l=this.data.formLocation.trim();
    if (!d||!w||!s||!e||!p) { wx.showToast({ title:'请填完必填项', icon:'none' }); return; }
    var payload = { date:d, weekday:w, start_time:s, end_time:e, duty_person:p, location:l };
    var that = this;
    var p2 = this.data.editMode ? api.updateDuty(this.data.editId, payload) : api.addDuty(payload);
    p2.then(function() {
      that.setData({ showModal: false, selectedDutyId: null, selectedDuty: null });
      that.loadAll();
      wx.showToast({ title:'操作成功', icon:'success' });
    }).catch(function(err) { wx.showToast({ title:err.message||'操作失败', icon:'none' }); });
  },

  // 删除值班（后端软删除，前端立即从列表移除）
  deleteDuty: function() {
    if (!this.data.isAdmin) { wx.showToast({ title: '无权限删除值班记录', icon: 'none' }); return; }
    var d = this.data.selectedDuty;
    if (!d) { wx.showToast({ title:'请先选择值班安排', icon:'none' }); return; }
    var that = this;
    wx.showModal({ title:'确认删除', content:'确定删除【'+d.date+' '+d.dutyPerson+'】的值班吗？',
      confirmColor:'#d9534f', success:function(r) {
        if (!r.confirm) return;
        api.deleteDuty(d.id).then(function() {
          // 从原始列表和展示列表中都移除
          var newRaw = (that.data.rawDuties || []).filter(function(x){ return Number(x.id) !== Number(d.id); });
          var newShow = that.data.duties.filter(function(x){ return Number(x.id) !== Number(d.id); });
          that.setData({ rawDuties: newRaw, duties: newShow, selectedDutyId: null, selectedDuty: null });
          wx.showToast({ title:'删除成功', icon:'success' });
        }).catch(function(err) { wx.showToast({ title:err.message, icon:'none' }); });
      }
    });
  },

  // ---- 打卡 ----
  onCheckinInput: function(e) {
    this.setData({ checkinPerson: e.detail.value });
    this.filterCheckedDuties();
  },

  doCheckin: function() {
    var person = (this.data.checkinPerson||'').trim();
    var selected = this.data.selectedDuty;
    if (!person) { wx.showToast({ title:'请输入打卡人姓名', icon:'none' }); return; }
    if (!selected) { wx.showToast({ title:'请选择值班安排', icon:'none' }); return; }
    if (person !== selected.dutyPerson) {
      wx.showToast({ title:'打卡人不是当前值班安排的值班人员，请重新选择', icon:'none' });
      return;
    }

    var that = this;
    var submitCheckin = function() {
      console.log('[打卡] 提交：duty_id='+selected.id+' user_name='+person);
      api.doCheckin({ duty_id: selected.id, user_name: person }).then(function(result) {
        // 打卡成功 — 立即从待打卡列表移除该值班
        var newShow = that.data.duties.filter(function(x){ return Number(x.id) !== Number(selected.id); });
        that.setData({
          selectedDutyId: null, selectedDuty: null,
          duties: newShow
        });
        // 刷新 checkins 列表
        api.getCheckins().then(function(ckRes) {
          var cks = (ckRes.data||[]).map(function(c){
            return { id:c.id, userName:c.user_name, dutyId:c.duty_id, checkinTime:c.checkin_time, status:c.status };
          });
          that.setData({ checkins: cks });
        });
        wx.showToast({ title:'打卡成功', icon:'success' });
      }).catch(function(err) { wx.showToast({ title:err.message||'打卡失败', icon:'none' }); });
    };

    // 先查重
    api.checkCheckin(selected.id, person).then(function(res) {
      if (res.data && res.data.hasChecked) {
        wx.showToast({ title:'请勿重复打卡', icon:'none' }); return;
      }
      submitCheckin();
    }).catch(function() { submitCheckin(); });
  },

  // 删除打卡记录（管理员权限）
  deleteCheckinRecord: function(e) {
    if (!this.data.isAdmin) { wx.showToast({ title: '无权限删除打卡记录', icon: 'none' }); return; }
    var ckId = Number(e.currentTarget.dataset.id);
    var ckItem = this.data.checkins.find(function(x) { return Number(x.id) === ckId; });
    if (!ckItem) { wx.showToast({ title: '记录不存在', icon: 'none' }); return; }
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '确定删除【' + ckItem.userName + '】的打卡记录吗？',
      confirmColor: '#d9534f',
      success: function(r) {
        if (!r.confirm) return;
        api.deleteCheckin(ckId).then(function() {
          // 立即从列表移除
          var newCheckins = that.data.checkins.filter(function(x) { return Number(x.id) !== ckId; });
          that.setData({ checkins: newCheckins });
          wx.showToast({ title: '删除成功', icon: 'success' });
        }).catch(function(err) {
          wx.showToast({ title: err.message, icon: 'none' });
        });
      }
    });
  }
});