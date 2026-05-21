// i18n – bilingual AR / EN support
(function () {
  const T = {
    // Header & nav
    home:          { ar: 'الرئيسية',       en: 'Home' },
    browse:        { ar: 'تصفّح',          en: 'Browse' },
    categories:    { ar: 'التصنيفات',      en: 'Categories' },
    searchHint:    { ar: 'ابحث عن تطبيق مهكر…', en: 'Search modded apps…' },
    search:        { ar: 'بحث',            en: 'Search' },

    // Hero
    heroEyebrow:   { ar: 'المتجر الحصري للتطبيقات المهكرة', en: 'The Exclusive Modded Apps Store' },
    heroTitle1:    { ar: 'كل التطبيقات المدفوعة،',         en: 'All Paid Apps,' },
    heroTitle2:    { ar: 'مفتوحة بالكامل ومجاناً.',        en: 'Fully Unlocked & Free.' },
    heroDesc:      { ar: 'تشكيلة منتقاة من أفضل التطبيقات والألعاب المهكرة. ميزات Premium مفتوحة، بدون إعلانات، بدون اشتراكات، وبدون دفع.',
                     en: 'A curated collection of the best modded apps and games. Premium features unlocked, no ads, no subscriptions, no payments.' },
    browseStore:   { ar: 'تصفّح المتجر',     en: 'Browse Store' },
    topRated:      { ar: 'الأعلى تقييماً',   en: 'Top Rated' },
    viewAll:       { ar: 'عرض جميع التطبيقات ←', en: '← View All Apps' },

    // Browse page
    allApps:       { ar: 'جميع التطبيقات المهكرة', en: 'All Modded Apps' },
    searchResults: { ar: 'نتائج البحث عن',   en: 'Search results for' },
    all:           { ar: 'الكل',             en: 'All' },
    sortRecent:    { ar: 'الأحدث',           en: 'Recent' },
    sortPopular:   { ar: 'الأكثر تنزيلاً',   en: 'Most Downloaded' },
    sortStars:     { ar: 'الأعلى تقييماً',   en: 'Top Rated' },
    sortName:      { ar: 'حسب الاسم',        en: 'By Name' },
    loadMore:      { ar: 'عرض المزيد',       en: 'Load More' },
    appCount:      { ar: 'تطبيق',            en: 'apps' },
    noResults:     { ar: 'لا توجد نتائج',    en: 'No Results' },
    noResultsHint: { ar: 'لم نعثر على تطبيقات تطابق بحثك. جرّب تغيير التصنيف أو كلمة البحث.', en: 'No apps match your search. Try a different category or keyword.' },

    // App page
    noApp:         { ar: 'لا يوجد تطبيق محدد', en: 'No app specified' },
    badLink:       { ar: 'الرابط غير صحيح.',   en: 'Invalid link.' },
    giveStar:      { ar: 'إعطاء نجمة',        en: 'Give a Star' },
    alreadyVoted:  { ar: 'لقد أعطيت نجمة لهذا التطبيق مسبقاً', en: 'You already rated this app' },
    thanksStar:    { ar: 'شكراً لتقييمك!',    en: 'Thanks for your rating!' },
    errorRetry:    { ar: 'حدث خطأ، حاول لاحقاً', en: 'An error occurred, try again later' },
    downloads:     { ar: 'تنزيلات',           en: 'Downloads' },
    stars:         { ar: 'نجوم',              en: 'Stars' },
    version:       { ar: 'الإصدار',           en: 'Version' },
    size:          { ar: 'الحجم',             en: 'Size' },
    minSdk:        { ar: 'الحد الأدنى',       en: 'Min Android' },
    downloadBtn:   { ar: 'تنزيل النسخة المهكّرة', en: 'Download Modded Version' },
    summary:       { ar: 'نبذة',              en: 'Summary' },
    screenshots:   { ar: 'لقطات الشاشة',      en: 'Screenshots' },
    description:   { ar: 'الوصف',             en: 'Description' },
    techInfo:      { ar: 'معلومات تقنية',      en: 'Technical Info' },
    pkgName:       { ar: 'اسم الحزمة',         en: 'Package Name' },
    versionCode:   { ar: 'رمز الإصدار',        en: 'Version Code' },
    minAndroid:    { ar: 'الحد الأدنى لأندرويد', en: 'Min Android' },
    dlCount:       { ar: 'عدد التنزيلات',      en: 'Downloads' },
    starsCount:    { ar: 'النجوم',             en: 'Stars' },
    developer:     { ar: 'المطوّر',            en: 'Developer' },
    category:      { ar: 'التصنيف',            en: 'Category' },
    publishDate:   { ar: 'تاريخ النشر',        en: 'Published' },
    lastUpdate:    { ar: 'آخر تحديث',          en: 'Last Updated' },
    installHint:   { ar: 'لتثبيت التطبيق المهكّر: فعّل خيار «تثبيت تطبيقات من مصادر غير معروفة» من إعدادات الأمان في جهازك، ثم افتح ملف APK الذي حملّته.',
                     en: 'To install: Enable "Install from Unknown Sources" in your device\'s security settings, then open the downloaded APK file.' },
    appNotFound:   { ar: 'تطبيق غير موجود',    en: 'App Not Found' },
    checkLink:     { ar: 'تأكد من الرابط أو عد للرئيسية.', en: 'Check the link or go back to the homepage.' },
    backHome:      { ar: 'العودة للرئيسية',    en: 'Back to Home' },
    close:         { ar: 'إغلاق',             en: 'Close' },

    // Categories page
    browseByCategory: { ar: 'تصفّح حسب التصنيف', en: 'Browse by Category' },
    catAppCount:      { ar: 'تطبيق',             en: 'app(s)' },
    catLoadError:     { ar: 'تعذّر تحميل التصنيفات. حاول لاحقاً.', en: 'Failed to load categories. Try again later.' },

    // Errors
    connError:     { ar: 'تعذّر الاتصال بالخادم.',     en: 'Could not connect to the server.' },
    connHint:      { ar: 'تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.', en: 'Check your internet connection and refresh.' },
    svcError:      { ar: 'خدمة المتجر غير متاحة مؤقتاً.', en: 'Store service is temporarily unavailable.' },
    svcHint:       { ar: 'حاول لاحقاً بعد دقائق قليلة.',  en: 'Please try again in a few minutes.' },
    loadError:     { ar: 'تعذّر تحميل البيانات.',       en: 'Failed to load data.' },
    loadAppsError: { ar: 'تعذّر تحميل التطبيقات',      en: 'Failed to load apps' },
    retryLater:    { ar: 'حاول لاحقاً.',               en: 'Try again later.' },

    // Home
    noAppsYet:     { ar: 'لا توجد تطبيقات بعد.',        en: 'No apps yet.' },
    noAppsHint:    { ar: 'ستظهر هنا تطبيقات المتجر فور إضافتها.', en: 'Store apps will appear here once added.' },

    // Footer
    footerTag:     { ar: '— المتجر الذهبي للتطبيقات المهكرة', en: '— The Golden Modded Apps Store' },
    allRights:     { ar: 'جميع الحقوق محفوظة', en: 'All Rights Reserved' },

    // Category names
    catGames:        { ar: 'ألعاب',             en: 'Games' },
    catSocial:       { ar: 'تواصل اجتماعي',     en: 'Social' },
    catTools:        { ar: 'أدوات',             en: 'Tools' },
    catProductivity: { ar: 'إنتاجية',           en: 'Productivity' },
    catEntertainment:{ ar: 'ترفيه',             en: 'Entertainment' },
    catEducation:    { ar: 'تعليم',             en: 'Education' },
    catPhotography:  { ar: 'تصوير',             en: 'Photography' },
    catMusic:        { ar: 'موسيقى',            en: 'Music' },
    catFinance:      { ar: 'مالية',             en: 'Finance' },
    catShopping:     { ar: 'تسوق',              en: 'Shopping' },
    catNews:         { ar: 'أخبار',             en: 'News' },
    catHealth:       { ar: 'صحة ولياقة',         en: 'Health & Fitness' },
    catTravel:       { ar: 'سفر',               en: 'Travel' },
    catOther:        { ar: 'أخرى',              en: 'Other' },

    // Units
    bytes:  { ar: ['ب', 'ك.ب', 'م.ب', 'ج.ب'], en: ['B', 'KB', 'MB', 'GB'] },
  };

  // Category slug → key map
  const catMap = {
    games: 'catGames', social: 'catSocial', tools: 'catTools',
    productivity: 'catProductivity', entertainment: 'catEntertainment',
    education: 'catEducation', photography: 'catPhotography', music: 'catMusic',
    finance: 'catFinance', shopping: 'catShopping', news: 'catNews',
    health: 'catHealth', travel: 'catTravel', other: 'catOther',
  };

  let lang = localStorage.getItem('gs_lang') || 'ar';

  function t(key) {
    const entry = T[key];
    if (!entry) return key;
    return entry[lang] || entry.ar;
  }

  function getLang() { return lang; }
  function isRTL() { return lang === 'ar'; }

  function setLang(l) {
    lang = l;
    localStorage.setItem('gs_lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    // Reload page to apply
    location.reload();
  }

  function catName(slug) {
    const key = catMap[slug];
    return key ? t(key) : slug;
  }

  // Apply dir/lang on load
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  window.GSLang = { t, getLang, setLang, isRTL, catName, T };
})();
