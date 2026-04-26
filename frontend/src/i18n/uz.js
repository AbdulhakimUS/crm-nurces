// src/i18n/uz.js — Ўзбекча таржима
const uz = {
  translation: {
    // Навигация
    nav: {
      myPatients: 'Mening bemorlarim',
      addPatient: 'Bemor qo\'shish',
      profile: 'Profil',
      logout: 'Chiqish',
      back: '← Orqaga',
    },
    // Авторизация
    auth: {
      login: 'Kirish',
      loginPlaceholder: 'Login',
      passwordPlaceholder: 'Parol',
      loginBtn: 'Kirish',
      adminPanel: 'Administrator paneli',
      clientPanel: 'Doktor kabineti',
      invalidCredentials: 'Login yoki parol noto\'g\'ri',
      logoutSuccess: 'Muvaffaqiyatli chiqildi',
    },
    // Пациенты
    patients: {
      title: 'Bemorlar',
      searchPlaceholder: 'FIO yoki pasport bo\'yicha qidirish...',
      noPatients: 'Bemorlar topilmadi',
      addNew: '+ Bemor qo\'shish',
      fullName: 'To\'liq ismi',
      passport: 'Pasport',
      phone: 'Telefon raqami',
      birthDate: 'Tug\'ilgan sana',
      bloodGroup: 'Qon guruhi',
      registrationDate: 'Ro\'yxatga olingan sana',
      extraFields: 'Qo\'shimcha ma\'lumotlar',
      addField: '+ Maydon qo\'shish',
      fieldLabel: 'Maydon nomi',
      fieldValue: 'Qiymat',
      data: 'Ma\'lumotlar',
      progress: 'Jarayon',
      edit: 'Tahrirlash',
      save: 'Saqlash',
      cancel: 'Bekor qilish',
      delete: 'O\'chirish',
      confirmDelete: 'Bemorni o\'chirishni tasdiqlaysizmi?',
      saved: 'Saqlandi',
      required: 'Majburiy maydon',
    },
    // Прогресс вакцинации
    progress: {
      title: 'Emlash jarayoni',
      addRecord: '+ Yozuv qo\'shish',
      recordTitle: 'Sarlavha',
      vaccineType: 'Emlash turi',
      description: 'Tavsif',
      date: 'Sana',
      photo: 'Rasm (ixtiyoriy)',
      noRecords: 'Jarayon yozuvlari yo\'q',
      addSuccess: 'Yozuv qo\'shildi',
      vaccineTypes: {
        covid: 'COVID-19',
        flu: 'Gripp',
        hepatitisB: 'Gepatit B',
        hepatitisA: 'Gepatit A',
        tetanus: 'Qoqshol',
        measles: 'Qizamiq',
        other: 'Boshqa',
      }
    },
    // Профиль
    profile: {
      title: 'Mening profilim',
      name: 'Ism',
      phone: 'Telefon',
      changePhoto: 'Rasmni o\'zgartirish',
      theme: 'Mavzu',
      themeLight: 'Yorug\'',
      themeDark: 'Qorong\'i',
      language: 'Til',
      changeCredentials: 'Login/parolni o\'zgartirish',
      currentPassword: 'Joriy parol',
      newLogin: 'Yangi login (ixtiyoriy)',
      newPassword: 'Yangi parol (ixtiyoriy)',
      updateSuccess: 'Profil yangilandi',
      credentialsUpdated: 'Kirish ma\'lumotlari yangilandi',
    },
    // Админка
    admin: {
      title: 'Administrator paneli',
      clients: 'Klientlar',
      statistics: 'Statistika',
      totalClients: 'Jami klientlar',
      totalPatients: 'Jami bemorlar',
      totalProgress: 'Jami yozuvlar',
      addClient: '+ Klient qo\'shish',
      editClient: 'Klientni tahrirlash',
      deleteClient: 'O\'chirish',
      confirmDeleteClient: 'Klientni o\'chirishni tasdiqlaysizmi?',
      login: 'Login',
      name: 'Ism',
      phone: 'Telefon',
      createdAt: 'Yaratilgan sana',
      actions: 'Amallar',
      changePassword: 'Parolni o\'zgartirish',
      currentPassword: 'Joriy parol',
      newPassword: 'Yangi parol',
    },
    // Общие
    common: {
      loading: 'Yuklanmoqda...',
      error: 'Xatolik yuz berdi',
      success: 'Muvaffaqiyatli',
      confirm: 'Tasdiqlash',
      close: 'Yopish',
      optional: 'ixtiyoriy',
      noData: 'Ma\'lumot yo\'q',
    }
  }
};

export default uz;