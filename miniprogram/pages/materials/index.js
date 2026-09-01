var auth = require('../../utils/auth');
var api = require('../../utils/api');

Page({
  data: {
    activeTab: 0,
    materials: [], records: [], unreturned: [],
    isAdmin: false,
    pickerOptions: [], pickerMaterials: [], pickerIndex: -1, selectedMaterial: null,
    borrowUserName: '', borrowNum: '', borrowPurpose: '', borrowNote: '',
    showForm: false, formTitle: '', editId: null, availableLocked: false,
    form: { code: '', name: '', category: '', total: '', available: '', location: '', status: '' },
    statusOptions: ['可借用', '已借完', '损坏'],
    statusIndex: 0,
    // 归还弹窗
    showReturnModal: false, returnRecordId: null, returnRecordName: '', returnNote: '',
    // 管理员批注弹窗
    showCommentModal: false, commentRecordId: null, commentText: ''
  },

  onShow: function () {
    if (!auth.requireLogin()) return;
    var u = auth.getCurrentUser();
    var adm = auth.isAdmin(); console.log('[物资] 当前用户：', u ? u.name : '?', '是否管理员：', adm);
    this.setData({ isAdmin: adm, borrowUserName: u ? u.name : '' });
    this.loadAll();
  },

  loadAll: function () {
    var that = this;
    Promise.all([api.getMaterials(), api.getBorrowRecords(), api.getUnreturnedRecords()]).then(function (res) {
      var mats = (res[0].data || []).filter(function(m){ return m.status !== '停用' && m.status !== '已删除'; });
      var recs = (res[1].data || []).map(function (r) {
        return {
          id: r.id, userName: r.user_name, materialName: r.material_name,
          materialId: r.material_id, borrowNum: r.borrow_num,
          borrowTime: r.borrow_time, returnTime: r.return_time, status: r.status,
          borrowNote: r.borrow_note || '', returnNote: r.return_note || '', adminComment: r.admin_comment || ''
        };
      });
      var unret = (res[2].data || []).map(function (r) {
        return {
          id: r.id, userName: r.user_name, materialName: r.material_name,
          materialId: r.material_id, borrowNum: r.borrow_num,
          borrowTime: r.borrow_time, status: r.status,
          borrowNote: r.borrow_note || ''
        };
      });
      // 借用选择器：仅「可借用」且 available > 0 的物资可被选择（损坏/已借完/停用/已删除一律不出现）
      var borrowable = mats.filter(function (m) {
        return m.status === '可借用' && Number(m.available) > 0;
      });
      var opts = borrowable.map(function (m) {
        return m.name + ' - ' + m.code + ' - 可借 ' + (m.available || 0);
      });
      that.setData({ materials: mats, records: recs, unreturned: unret, pickerOptions: opts, pickerMaterials: borrowable });
    });
  },

  switchTab: function (e) {
    var i = parseInt(e.currentTarget.dataset.index);
    this.setData({ activeTab: i, pickerIndex: -1, selectedMaterial: null,
      borrowNum: '', borrowPurpose: '', borrowNote: '' });
  },

  // ======== 物资台账 ========
  showAddForm: function () {
    this.setData({
      showForm: true, formTitle: '新增物资', editId: null,
      statusIndex: 0, availableLocked: false,
      form: { code: '', name: '', category: '', total: '', available: '', location: '', status: '可借用' }
    });
  },

  showEditForm: function (e) {
    var id = Number(e.currentTarget.dataset.id);
    if (!id) { wx.showToast({ title: '物资ID无效', icon: 'none' }); return; }
    var m = this.data.materials.find(function (x) { return Number(x.id) === id; });
    if (!m) { wx.showToast({ title: '物资不存在', icon: 'none' }); return; }
    var opts = this.data.statusOptions;
    var si = opts.indexOf(m.status || '可借用');
    var blocked = (m.status === '已借完' || m.status === '损坏' || m.status === '停用' || m.status === '已删除');
    this.setData({
      showForm: true, formTitle: '编辑物资', editId: m.id,
      statusIndex: si >= 0 ? si : 0, availableLocked: blocked,
      form: {
        code: m.code || '', name: m.name || '', category: m.category || '',
        total: String(m.total || 0), available: blocked ? '0' : String(m.available || 0),
        location: m.location || '', status: m.status || '可借用'
      }
    });
  },

  onStatusChange: function (e) {
    var idx = Number(e.detail.value);
    var st = this.data.statusOptions[idx];
    var upd = { statusIndex: idx, 'form.status': st };
    // 不可借状态：可借数量立即归 0 并锁定输入，避免表单出现「损坏 + 可借1」矛盾
    if (st === '已借完' || st === '损坏') {
      upd['form.available'] = '0';
      upd.availableLocked = true;
    } else {
      upd.availableLocked = false;
    }
    this.setData(upd);
  },

  onDelete: function (e) {
    var id = Number(e.currentTarget.dataset.id);
    var that = this;
    wx.showModal({ title: '确认删除', content: '确定删除该物资吗？', confirmColor: '#d9534f', success: function (r) {
      if (r.confirm) {
        api.deleteMaterial(id).then(function () {
          var list = that.data.materials.filter(function(m){ return Number(m.id) !== id; });
          that.setData({ materials: list });
          wx.showToast({ title: '已停用', icon: 'success' });
        }).catch(function (err) { wx.showToast({ title: err.message, icon: 'none' }); });
      }
    }});
  },

  closeForm: function () { this.setData({ showForm: false }); },
  noop: function () {},

  onFormInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var obj = {}; obj['form.' + field] = e.detail.value; this.setData(obj);
  },

  submitForm: function () {
    var f = this.data.form;
    var code = (f.code || '').trim(), name = (f.name || '').trim(), category = (f.category || '').trim();
    var total = parseInt(f.total) || 0;
    var available = parseInt(f.available); if (isNaN(available)) available = total;
    var location = (f.location || '').trim();
    var status = f.status || (available > 0 ? '可借用' : '已借完');
    // 前端兜底：不可借状态一律强制可借数量为 0（与后端规则一致）
    if (status === '已借完' || status === '损坏' || status === '停用' || status === '已删除') {
      available = 0;
    }

    if (!code) { wx.showToast({ title: '物资编号不能为空', icon: 'none' }); return; }
    if (!name) { wx.showToast({ title: '物资名称不能为空', icon: 'none' }); return; }
    if (!category) { wx.showToast({ title: '分类不能为空', icon: 'none' }); return; }
    if (total <= 0) { wx.showToast({ title: '总量必须大于0', icon: 'none' }); return; }
    if (available < 0) { wx.showToast({ title: '可借数量不能小于0', icon: 'none' }); return; }
    if (available > total) { wx.showToast({ title: '可借数量不能大于总量', icon: 'none' }); return; }

    var payload = { code: code, name: name, category: category, total: total, available: available, location: location, status: status };
    var that = this;
    var p = this.data.editId != null ? api.updateMaterial(this.data.editId, payload) : api.addMaterial(payload);
    p.then(function () { that.setData({ showForm: false }); that.loadAll(); wx.showToast({ title: '操作成功', icon: 'success' }); })
     .catch(function (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }); });
  },

  // ======== 借用 ========
  onPickerChange: function (e) {
    var idx = parseInt(e.detail.value);
    var list = this.data.pickerMaterials || [];
    this.setData({ pickerIndex: idx, selectedMaterial: list[idx] });
  },
  onBorrowField: function (e) { var o = {}; o[e.currentTarget.dataset.field] = e.detail.value; this.setData(o); },

  confirmBorrow: function () {
    var m = this.data.selectedMaterial;
    if (!m) { wx.showToast({ title: '请选择物资', icon: 'none' }); return; }

    // 状态校验
    if (m.status === '损坏') { wx.showToast({ title: '该物资已损坏，无法借用', icon: 'none' }); return; }
    if (m.status === '已借完' || Number(m.available) <= 0) { wx.showToast({ title: '该物资已借完，无法借用', icon: 'none' }); return; }

    var name = (this.data.borrowUserName||'').trim();
    if (!name) { wx.showToast({ title: '请输入借用人姓名', icon: 'none' }); return; }
    var num = parseInt(this.data.borrowNum)||0;
    if (isNaN(num) || num <= 0) { wx.showToast({ title: '请输入正确的数量', icon: 'none' }); return; }
    if (num > m.available) { wx.showToast({ title: '库存不足', icon: 'none' }); return; }
    var purpose = (this.data.borrowPurpose||'').trim();
    if (!purpose) { wx.showToast({ title: '请输入用途', icon: 'none' }); return; }

    var that = this;
    api.borrowMaterial({
      user_name: name, material_id: m.id, borrow_num: num,
      purpose: purpose, borrow_note: (this.data.borrowNote || '').trim()
    }).then(function () {
      that.setData({ pickerIndex: -1, selectedMaterial: null, borrowNum: '', borrowPurpose: '', borrowNote: '' });
      that.loadAll();
      wx.showToast({ title: '借用成功', icon: 'success' });
    }).catch(function (err) { wx.showToast({ title: err.message, icon: 'none' }); });
  },

  // ======== 归还 ========
  openReturnModal: function (e) {
    var id = Number(e.currentTarget.dataset.id);
    var r = this.data.unreturned.find(function(x) { return Number(x.id) === id; });
    if (!r) return;
    this.setData({ showReturnModal: true, returnRecordId: id, returnRecordName: r.materialName, returnNote: '' });
  },

  closeReturnModal: function () { this.setData({ showReturnModal: false, returnRecordId: null, returnNote: '' }); },

  onReturnNoteInput: function (e) { this.setData({ returnNote: e.detail.value }); },

  confirmReturnWithNote: function () {
    var id = this.data.returnRecordId;
    var note = (this.data.returnNote || '').trim();
    var that = this;
    api.returnMaterial(id, { return_note: note }).then(function () {
      that.setData({ showReturnModal: false, returnRecordId: null, returnNote: '' });
      that.loadAll();
      wx.showToast({ title: '归还成功', icon: 'success' });
    }).catch(function (err) { wx.showToast({ title: err.message, icon: 'none' }); });
  },

  // ======== 管理员批注 ========
  openCommentModal: function (e) {
    var id = Number(e.currentTarget.dataset.id);
    var rec = this.data.records.find(function(x) { return Number(x.id) === id; });
    if (!rec) return;
    this.setData({ showCommentModal: true, commentRecordId: id, commentText: rec.adminComment || '' });
  },

  closeCommentModal: function () { this.setData({ showCommentModal: false, commentRecordId: null, commentText: '' }); },

  onCommentInput: function (e) { this.setData({ commentText: e.detail.value }); },

  submitComment: function () {
    var id = this.data.commentRecordId;
    var text = (this.data.commentText || '').trim();
    if (!text) { wx.showToast({ title: '请输入批注内容', icon: 'none' }); return; }
    var that = this;
    api.updateBorrowComment(id, { admin_comment: text }).then(function () {
      that.setData({ showCommentModal: false, commentRecordId: null, commentText: '' });
      that.loadAll();
      wx.showToast({ title: '批注成功', icon: 'success' });
    }).catch(function (err) { wx.showToast({ title: err.message, icon: 'none' }); });
  }
});