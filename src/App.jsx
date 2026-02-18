import React, { useState, useMemo, useEffect } from 'react';
import {
  Upload,
  FileText,
  BarChart3,
  Table as TableIcon,
  Package,
  AlertCircle,
  TrendingUp,
  Truck,
  MinusCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Archive,
  ArrowDownCircle,
  RefreshCcw,
  X,
  Layers,
  Hash,
  Coins,
  Info,
  Download,
  Calculator,
  ShoppingCart,
  Lock,
  Save,
  Tag,
  Wallet,
  Calendar,
  ArrowRight,
  Filter,
  ExternalLink,
  ChevronRight,
  PieChart,
  List,
  ChevronLeft
} from 'lucide-react';

// --- Глобальные вспомогательные функции ---

const parseWBNum = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const parseWBDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date((dateStr - 25569) * 86400 * 1000);
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
    const [d, m, y] = s.split('.');
    return new Date(`${y}-${m}-${d}`);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const getArt = (row) => {
  const val = row['Артикул поставщика'] || row['Артикул'] || row['vendor_code'] || row['SaName'] || '';
  return String(val).trim();
};

const formatDateForInput = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const isRowInRange = (row, start, end) => {
  const d = parseWBDate(row['Дата продажи'] || row['Дата']);
  if (!d) return true;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

const formatMoney = (val) => {
  const num = typeof val === 'number' ? val : 0;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
};

// --- Под-компоненты ---

const MiniStat = ({ title, value, color, icon, subValue }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
    indigo: 'bg-indigo-50 text-indigo-600'
  };
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[100px] hover:shadow-md transition-all text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">{title}</span>
        <div className={`p-1.5 rounded-xl ${colors[color] || colors.slate}`}>{icon}</div>
      </div>
      <div>
        <div className="text-lg font-black text-slate-800 tracking-tight leading-none">{formatMoney(value)}</div>
        {subValue && <div className="text-[9px] font-bold text-slate-400 mt-1.5 leading-none bg-slate-50 p-1.5 rounded-lg border border-slate-100">{subValue}</div>}
      </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>{label}</button>
);

const CalcInput = ({ label, value, onChange, suffix, highlight }) => (
  <div className="flex flex-col gap-1.5 text-left font-sans">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">{label}</label>
    <div className="relative group">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-3 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all pr-8 ${highlight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200'}`}
      />
      <span className="absolute right-3 top-3.5 text-slate-400 text-[10px] font-black">{suffix}</span>
    </div>
  </div>
);

// --- Основной компонент ---

const App = () => {
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('total');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [costPrices, setCostPrices] = useState({});
  const [savedPrices, setSavedPrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [libReady, setLibReady] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [notification, setNotification] = useState(null);

  const [calcData, setCalcData] = useState(null);
  const [activeSku, setActiveSku] = useState(null);
  const [historySku, setHistorySku] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => setLibReady(true);
    document.head.appendChild(script);

    const savedCosts = localStorage.getItem('wb_cost_prices_v4');
    if (savedCosts) setCostPrices(JSON.parse(savedCosts));

    const savedLocked = localStorage.getItem('wb_locked_prices_v1');
    if (savedLocked) setSavedPrices(JSON.parse(savedLocked));

    const auth = localStorage.getItem('wb_tg_auth_v1');
    if (auth === 'true') setIsAuthorized(true);
  }, []);

  const handleCheckSub = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      setIsAuthorized(true);
      localStorage.setItem('wb_tg_auth_v1', 'true');
      setNotification({ type: 'success', text: 'Доступ разрешен!' });
    }, 2500);
  };

  const persistSavedPrices = (newPrices) => {
    setSavedPrices(newPrices);
    localStorage.setItem('wb_locked_prices_v1', JSON.stringify(newPrices));
  };

  // --- Мемоизированные расчеты ---

  const currentDataFiltered = useMemo(() => {
    let baseData = (selectedFileId === 'total') ? files.flatMap(f => f.rows) : (files.find(f => f.id === selectedFileId)?.rows || []);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return baseData.filter(row => isRowInRange(row, start, end));
  }, [files, selectedFileId, startDate, endDate]);

  const dashboardStats = useMemo(() => {
    let data = currentDataFiltered;
    if (activeSku) data = data.filter(r => getArt(r) === activeSku);
    const stats = { realized: 0, toTransfer: 0, delivery: 0, deliveryCount: 0, fines: 0, storage: 0, withholdings: 0, acceptance: 0, count: 0 };
    data.forEach(row => {
      const type = row['Обоснование для оплаты'] || row['Тип документа'] || 'Прочее';
      let realized = parseWBNum(row['Вайлдберриз реализовал Товар (Пр)']);
      let toTransfer = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
      if (type === 'Возврат') { realized = -Math.abs(realized); toTransfer = -Math.abs(toTransfer); }
      stats.realized += realized;
      stats.toTransfer += toTransfer;
      const delivery = parseWBNum(row['Услуги по доставке товара покупателю']);
      stats.delivery += delivery;
      if (delivery > 0) stats.deliveryCount += Math.abs(parseInt(row['Кол-во']) || 1);
      stats.fines += parseWBNum(row['Общая сумма штрафов']);
      stats.storage += parseWBNum(row['Хранение'] || row['Сумма по полю Хранение']);
      stats.withholdings += parseWBNum(row['Удержания'] || row['Сумма по полю Удержания']);
      stats.acceptance += parseWBNum(row['Операции на приемке'] || row['Сумма по полю Операции на приемке']);
      const c = parseInt(row['Кол-во']) || 0;
      if (type === 'Продажа') stats.count += c;
      if (type === 'Возврат') stats.count -= c;
    });
    return stats;
  }, [currentDataFiltered, activeSku]);

  const allArticleStats = useMemo(() => {
    const articles = {};
    currentDataFiltered.forEach(row => {
      const art = getArt(row);
      if (!art) return;
      if (!articles[art]) articles[art] = { count: 0, revenue: 0, toSeller: 0, delivery: 0, deliveryCount: 0, fines: 0, storage: 0, withholdings: 0, acceptance: 0, returnCount: 0, kvvSum: 0, kvvCount: 0, acqSum: 0, acqCount: 0, grossSalesSum: 0, grossSalesCount: 0 };
      const type = row['Обоснование для оплаты'];
      const count = parseInt(row['Кол-во']) || 0;
      let realized = parseWBNum(row['Вайлдберриз реализовал Товар (Пр)']);
      let toTransfer = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
      const salePrice = parseWBNum(row['Цена розничная с учетом согласованной скидки']);
      if (type === 'Продажа') {
        articles[art].count += count;
        if (salePrice > 0) { articles[art].grossSalesSum += salePrice * count; articles[art].grossSalesCount += count; }
      } else if (type === 'Возврат') {
        realized = -Math.abs(realized); toTransfer = -Math.abs(toTransfer);
        articles[art].returnCount += count; articles[art].count -= count;
      }
      articles[art].revenue += realized;
      articles[art].toSeller += toTransfer;
      const delivery = parseWBNum(row['Услуги по доставке товара покупателю']);
      articles[art].delivery += delivery;
      if (delivery > 0) articles[art].deliveryCount += Math.abs(count || 1);
      articles[art].fines += parseWBNum(row['Общая сумма штрафов']);
      articles[art].storage += parseWBNum(row['Хранение'] || row['Сумма по полю Хранение']);
      articles[art].withholdings += parseWBNum(row['Удержания'] || row['Сумма по полю Удержания']);
      articles[art].acceptance += parseWBNum(row['Операции на приемке'] || row['Сумма по полю Операции на приемке']);
      const kvv = parseWBNum(row['Размер кВВ, %']);
      const acq = parseWBNum(row['Размер комиссии за эквайринг/Комиссии за организацию платежей, %']);
      if (kvv !== 0) { articles[art].kvvSum += Math.abs(kvv) * Math.abs(count || 1); articles[art].kvvCount += Math.abs(count || 1); }
      if (acq !== 0) { articles[art].acqSum += Math.abs(acq) * Math.abs(count || 1); articles[art].acqCount += Math.abs(count || 1); }
    });
    return articles;
  }, [currentDataFiltered]);

  const summaryData = useMemo(() => {
    const stats = {};
    currentDataFiltered.forEach(row => {
      const type = row['Обоснование для оплаты'] || row['Тип документа'] || 'Прочее';
      if (!stats[type]) stats[type] = { realized: 0, toTransfer: 0, delivery: 0, fines: 0, storage: 0, withholdings: 0, acceptance: 0 };
      let realized = parseWBNum(row['Вайлдберриз реализовал Товар (Пр)']);
      let toTransfer = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
      if (type === 'Возврат') { realized = -Math.abs(realized); toTransfer = -Math.abs(toTransfer); }
      stats[type].realized += realized; stats[type].toTransfer += toTransfer;
      stats[type].delivery += parseWBNum(row['Услуги по доставке товара покупателю']);
      stats[type].fines += parseWBNum(row['Общая сумма штрафов']);
      stats[type].storage += parseWBNum(row['Хранение'] || row['Сумма по полю Хранение']);
      stats[type].withholdings += parseWBNum(row['Удержания'] || row['Сумма по полю Удержания']);
      stats[type].acceptance += parseWBNum(row['Операции на приемке'] || row['Сумма по полю Операции на приемке']);
    });
    return stats;
  }, [currentDataFiltered]);

  const amountToBank = dashboardStats.toTransfer - dashboardStats.delivery - dashboardStats.fines - dashboardStats.storage - dashboardStats.withholdings - dashboardStats.acceptance;
  const totalCostForView = activeSku ? (costPrices[activeSku] || 0) * dashboardStats.count : Object.entries(allArticleStats).reduce((acc, [art, vals]) => acc + ((costPrices[art] || 0) * vals.count), 0);
  const finalNet = amountToBank - totalCostForView;

  const calculatedResult = useMemo(() => {
    if (!calcData) return { sitePrice: 0, buyerPrice: 0 };
    const { cost, avgLogistics, commission, acquiring, tax, other, desiredProfit, spp } = calcData;
    const factor = 1 - (parseFloat(commission) + parseFloat(acquiring) + parseFloat(tax)) / 100;
    if (factor <= 0) return { sitePrice: 0, buyerPrice: 0 };
    const base = parseFloat(cost) + parseFloat(avgLogistics) + parseFloat(other) + parseFloat(desiredProfit);
    const sitePrice = Math.ceil(base / factor);
    const buyerPrice = Math.ceil(sitePrice * (1 - parseFloat(spp) / 100));
    return { sitePrice, buyerPrice };
  }, [calcData]);

  const handleFileUpload = async (e) => {
    const uploaded = Array.from(e.target.files);
    if (uploaded.length === 0 || !libReady) return;
    setIsLoading(true);
    const res = [];
    for (const file of uploaded) {
      const data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const bstr = ev.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary' });
            resolve(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
          } catch { resolve(null); }
        };
        reader.readAsBinaryString(file);
      });
      if (data) res.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, reportNumber: data[0]?.['№'] || file.name.split('.')[0], rows: data });
    }
    setFiles(prev => [...prev, ...res]);
    setIsLoading(false);
  };

  const handleCostPriceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !libReady) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = window.XLSX.read(ev.target.result, { type: 'binary' });
        const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const newCosts = { ...costPrices };
        raw.forEach(r => { const art = getArt(r); const cost = parseWBNum(r['Себестоимость'] || r['цена закуп']); if (art && cost) newCosts[art] = cost; });
        setCostPrices(newCosts); localStorage.setItem('wb_cost_prices_v4', JSON.stringify(newCosts));
        setNotification({ type: 'success', text: 'Цены загружены' });
      } catch { setNotification({ type: 'error', text: 'Ошибка загрузки' }); }
      finally { setIsLoading(false); e.target.value = null; }
    };
    reader.readAsBinaryString(file);
  };

  const openCalculatorModal = (art, stats) => {
    const avgLog = stats.deliveryCount > 0 ? (stats.delivery / stats.deliveryCount) : 0;
    const avgComm = stats.kvvCount > 0 ? (stats.kvvSum / stats.kvvCount) : 20;
    const avgAcq = stats.acqCount > 0 ? (stats.acqSum / stats.acqCount) : 2;
    setCalcData({ art, cost: costPrices[art] || 0, avgLogistics: Math.round(avgLog), commission: parseFloat(avgComm.toFixed(2)), acquiring: parseFloat(avgAcq.toFixed(2)), tax: 6, other: 50, desiredProfit: 300, spp: 15 });
  };

  if (!isAuthorized) return (
    <div className="fixed inset-0 z-[1000] bg-slate-900 flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[120px]"></div>
      </div>
      <div className="bg-white/10 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 text-center shadow-2xl relative animate-bounce-in">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl rotate-12"><Lock className="text-white" size={32} /></div>
        <h2 className="text-white text-2xl font-black mb-3 italic">Добро пожаловать!</h2>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          Мы рады видеть вас в нашей команде! Ваша подписка на канал очень поможет нашему развитию.
          Как говорится, <strong>часть команды — часть корабля!</strong>
          Давайте вместе внедрять ИИ и смелые задумки в ваш бизнес!
        </p>
        <div className="bg-white/5 rounded-xl p-5 mb-6 text-left border border-white/10">
          <div className="flex gap-3 mb-4"><TrendingUp className="text-emerald-400 shrink-0" size={18} /><p className="text-[11px] text-slate-100 font-bold uppercase tracking-wider leading-tight">Присоединяйтесь к сообществу предпринимателей нового поколения</p></div>
          <a href="https://t.me/AI_Business_Online" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-indigo-600 p-4 rounded-xl text-white group hover:bg-indigo-500 transition-all shadow-lg">
            <span className="font-black text-sm">@AI_Business_Online</span><ExternalLink size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
        <button onClick={handleCheckSub} disabled={isChecking} className="w-full py-5 bg-white text-slate-900 rounded-xl font-black text-sm hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-xl">
          {isChecking ? <><Loader2 className="animate-spin text-indigo-600" size={20} />Проверка команды...</> : 'Взойти на борт'}
        </button>
        <p className="mt-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest">AI & Business Integration System</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 pb-12 transition-all">
      {notification && (
        <div className="fixed top-6 right-6 z-[200] p-4 rounded-xl shadow-xl bg-white flex items-center gap-3 animate-bounce-in">
          {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-rose-500" />}
          <span className="text-sm font-bold">{notification.text}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-50"><X size={14} /></button>
        </div>
      )}

      {calcData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-bounce-in my-8">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl">Калькулятор: {calcData.art}</h3>
                <p className="text-[10px] opacity-70 font-bold uppercase">Расчет целевой цены для маркетплейса</p>
              </div>
              <X className="cursor-pointer hover:rotate-90 transition-all" onClick={() => setCalcData(null)} />
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <CalcInput label="Себест." value={calcData.cost} suffix="₽" onChange={v => setCalcData({ ...calcData, cost: v })} />
                <CalcInput label="Логистика" value={calcData.avgLogistics} suffix="₽" onChange={v => setCalcData({ ...calcData, avgLogistics: v })} />
                <CalcInput label="Комиссия" value={calcData.commission} suffix="%" onChange={v => setCalcData({ ...calcData, commission: v })} />
                <CalcInput label="Эквайринг" value={calcData.acquiring} suffix="%" onChange={v => setCalcData({ ...calcData, acquiring: v })} />
                <CalcInput label="Налог" value={calcData.tax} suffix="%" onChange={v => setCalcData({ ...calcData, tax: v })} highlight />
                <CalcInput label="Прочие" value={calcData.other} suffix="₽" onChange={v => setCalcData({ ...calcData, other: v })} />
                <CalcInput label="Прибыль" value={calcData.desiredProfit} suffix="₽" onChange={v => setCalcData({ ...calcData, desiredProfit: v })} highlight />
                <CalcInput label="СПП" value={calcData.spp} suffix="%" onChange={v => setCalcData({ ...calcData, spp: v })} />
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] grid grid-cols-2 gap-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} className="text-white" /></div>
                <div className="relative z-10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Рекоменд. цена (сайт)</p>
                  <p className="text-3xl font-black text-white">{formatMoney(calculatedResult.sitePrice)}</p>
                </div>
                <div className="relative z-10 border-l border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Ожид. цена (покупатель)</p>
                  <p className="text-3xl font-black text-emerald-400">{formatMoney(calculatedResult.buyerPrice)}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  persistSavedPrices({ ...savedPrices, [calcData.art]: calculatedResult.sitePrice });
                  setNotification({ type: 'success', text: 'Цена сохранена в системе' });
                  setCalcData(null);
                }}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200"
              >
                <Save size={18} /> Сохранить настройки цены
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto p-4 md:p-8">
        <header className="mb-8 flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter">WB ANALYST <span className="text-indigo-600">PREM</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Система глубокой аналитики</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label className="bg-indigo-600 text-white px-5 py-3 rounded-2xl cursor-pointer text-xs font-black flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md active:scale-95">
              <Upload size={16} /> Загрузить отчеты
              <input type="file" className="hidden" multiple accept=".xlsx" onChange={handleFileUpload} />
            </label>
            <label className="bg-emerald-50 text-emerald-600 border-2 border-emerald-100 px-5 py-[10px] rounded-2xl cursor-pointer text-xs font-black flex items-center gap-2 hover:bg-emerald-100 transition-all">
              <Package size={16} /> Себестоимость
              <input type="file" className="hidden" accept=".xlsx" onChange={handleCostPriceUpload} />
            </label>
            {files.length > 0 && (
              <button onClick={() => { setFiles([]); setSelectedFileId('total'); }} className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="Очистить всё">
                <RefreshCcw size={18} />
              </button>
            )}
          </div>
        </header>

        {files.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-32 text-center border-4 border-dashed border-slate-50 flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><FileText size={40} /></div>
            <div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm mb-2">Нет данных для анализа</p>
              <p className="text-slate-300 text-xs">Загрузите еженедельные отчеты реализации WB для начала работы</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl flex-1 w-full overflow-hidden">
                <Hash className="text-slate-400 ml-2" size={16} />
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold outline-none flex-1 truncate py-1 pr-8"
                >
                  <option value="total">Все отчеты консолидированно ({files.length} шт)</option>
                  {files.map(f => (
                    <option key={f.id} value={f.id}>Отчет №{f.reportNumber} ({f.name})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl w-full md:w-auto">
                <Calendar className="text-slate-400 ml-2" size={16} />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold outline-none uppercase" />
                <span className="text-slate-300">—</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold outline-none uppercase" />
              </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <MiniStat title="К перечислению" value={dashboardStats.toTransfer} color="emerald" icon={<TrendingUp size={16} />} />
              <MiniStat title="Логистика" value={dashboardStats.delivery} color="blue" icon={<Truck size={16} />} subValue={`${dashboardStats.deliveryCount} доставок | ${Math.round(dashboardStats.delivery / dashboardStats.deliveryCount || 0)} ₽/шт`} />
              <MiniStat title="Штрафы/Прочее" value={dashboardStats.fines + dashboardStats.storage + dashboardStats.withholdings + dashboardStats.acceptance} color="rose" icon={<ShieldAlert size={16} />} />
              <MiniStat title="Себестоимость" value={totalCostForView} color="slate" icon={<Archive size={16} />} subValue={`${dashboardStats.count} шт`} />

              <div className="col-span-2 bg-indigo-600 p-6 rounded-[2rem] text-white flex flex-col justify-between shadow-xl shadow-indigo-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><Coins size={120} /></div>
                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Чистая прибыль (Финал)</span>
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md"><Wallet size={16} /></div>
                </div>
                <div className="relative z-10">
                  <span className="text-3xl font-black">{formatMoney(finalNet)}</span>
                  <div className="mt-2 text-[10px] font-bold bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                    Маржинальность: {dashboardStats.toTransfer > 0 ? ((finalNet / dashboardStats.toTransfer) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-fit">
              <TabBtn active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Сводка по типам" />
              <TabBtn active={activeTab === 'articles'} onClick={() => setActiveTab('articles')} label="Анализ товаров" />
            </div>

            {activeTab === 'summary' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(summaryData).map(([type, stats]) => (
                  <div key={type} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-slate-50 rounded-xl text-slate-500"><Layers size={18} /></div>
                      <h4 className="font-black text-sm uppercase tracking-tight">{type}</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px]"><span className="text-slate-400 font-bold uppercase">Реализация</span><span className="font-black">{formatMoney(stats.realized)}</span></div>
                      <div className="flex justify-between items-center text-[11px]"><span className="text-slate-400 font-bold uppercase">К выплате</span><span className="font-black text-indigo-600">{formatMoney(stats.toTransfer)}</span></div>
                      <div className="pt-2 border-t border-slate-50 flex justify-between items-center text-[10px]"><span className="text-slate-300 font-bold">Услуги WB</span><span className="font-bold text-rose-400">-{formatMoney(stats.delivery + stats.fines + stats.storage + stats.withholdings + stats.acceptance)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-sans">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-6 text-left">Артикул / Товар</th>
                        <th className="p-6 text-center">Продажи</th>
                        <th className="p-6 text-right">Выручка</th>
                        <th className="p-6 text-right">К выплате</th>
                        <th className="p-6 text-right">Прибыль Факт</th>
                        <th className="p-6 text-right text-indigo-600 bg-indigo-50/30">Прибыль Товар</th>
                        <th className="p-6 text-center">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Object.entries(allArticleStats).map(([art, vals]) => {
                        const wbCosts = vals.delivery + vals.fines + vals.storage + vals.withholdings + vals.acceptance;
                        const profitFact = vals.toSeller - wbCosts - (costPrices[art] || 0) * vals.count;
                        const avgLog = (vals.deliveryCount > 0 ? vals.delivery / vals.deliveryCount : 0);
                        const profitItem = vals.toSeller - (avgLog * vals.count) - (vals.fines + vals.storage + vals.withholdings + vals.acceptance) - (costPrices[art] || 0) * vals.count;

                        return (
                          <tr key={art} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="p-6">
                              <div className="font-black text-slate-700">{art}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                {savedPrices[art] ? `LOCKED: ${formatMoney(savedPrices[art])}` : 'ЦЕНА НЕ ЗАДАНА'}
                              </div>
                            </td>
                            <td className="p-6 text-center">
                              <span className="px-3 py-1 bg-slate-100 rounded-lg font-black">{vals.count} шт</span>
                              {vals.returnCount > 0 && <div className="text-[9px] text-rose-400 font-bold mt-1">Возвраты: {vals.returnCount}</div>}
                            </td>
                            <td className="p-6 text-right font-bold">{formatMoney(vals.revenue)}</td>
                            <td className="p-6 text-right font-bold text-indigo-600">{formatMoney(vals.toSeller)}</td>
                            <td className={`p-6 text-right font-black ${profitFact < 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                              {formatMoney(profitFact)}
                            </td>
                            <td className={`p-6 text-right font-black bg-indigo-50/20 ${profitItem < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                              {formatMoney(profitItem)}
                            </td>
                            <td className="p-6 text-center">
                              <button
                                onClick={() => openCalculatorModal(art, vals)}
                                className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Рассчитать цену"
                              >
                                <Calculator size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes bounce-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>
    </div>
  );
};

export default App;

