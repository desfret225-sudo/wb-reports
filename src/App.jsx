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
  List
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
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  // DD.MM.YYYY
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
      setNotification({ type: 'success', text: 'Добро пожаловать в команду!' });
    }, 2500);
  };

  const TelegramAuth = () => (
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

  if (!isAuthorized) return <TelegramAuth />;

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
      if (kvv !== 0) {
        articles[art].kvvSum += Math.abs(kvv) * Math.abs(count || 1);
        articles[art].kvvCount += Math.abs(count || 1);
      }
      if (acq !== 0) {
        articles[art].acqSum += Math.abs(acq) * Math.abs(count || 1);
        articles[art].acqCount += Math.abs(count || 1);
      }
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

  const historyData = useMemo(() => {
    if (!historySku) return null;
    return currentDataFiltered.filter(r => getArt(r) === historySku).sort((a, b) => parseWBDate(b['Дата продажи'] || b['Дата']) - parseWBDate(a['Дата продажи'] || a['Дата']));
  }, [historySku, currentDataFiltered]);

  const handleFileUpload = async (event) => {
    const uploaded = Array.from(event.target.files);
    if (uploaded.length === 0 || !libReady) return;
    setIsLoading(true);
    const newFiles = [];
    for (const file of uploaded) {
      const data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const wb = window.XLSX.read(e.target.result, { type: 'binary' });
            resolve(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
          } catch { resolve(null); }
        };
        reader.readAsBinaryString(file);
      });
      if (data) newFiles.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, reportNumber: data[0]?.['№'] || file.name.split('.')[0], rows: data });
    }
    setFiles(prev => [...prev, ...newFiles]);
    setIsLoading(false);
  };

  const handleCostPriceUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !libReady) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'binary' });
        const raw = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const nCosts = { ...costPrices };
        raw.forEach(r => { const art = getArt(r); const cost = parseWBNum(r['Себестоимость'] || r['цена закуп']); if (art && cost) nCosts[art] = cost; });
        setCostPrices(nCosts); localStorage.setItem('wb_cost_prices_v4', JSON.stringify(nCosts));
        setNotification({ type: 'success', text: 'Цены загружены' });
      } catch { setNotification({ type: 'error', text: 'Ошибка загрузки' }); }
      finally { setIsLoading(false); event.target.value = null; }
    };
    reader.readAsBinaryString(file);
  };

  const openCalculatorModal = (art, stats) => {
    const avgLog = stats.deliveryCount > 0 ? (stats.delivery / stats.deliveryCount) : 0;
    const avgComm = stats.kvvCount > 0 ? (stats.kvvSum / stats.kvvCount) : 20;
    const avgAcq = stats.acqCount > 0 ? (stats.acqSum / stats.acqCount) : 2;
    setCalcData({ art, cost: costPrices[art] || 0, avgLogistics: Math.round(avgLog), commission: parseFloat(avgComm.toFixed(2)), acquiring: parseFloat(avgAcq.toFixed(2)), tax: 6, other: 50, desiredProfit: 300, spp: 15 });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 pb-12 transition-all text-left">
      {notification && (
        <div className="fixed top-6 right-6 z-[200] p-4 rounded-xl shadow-xl bg-white flex items-center gap-3 animate-bounce-in">
          {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-rose-500" />}
          <span className="text-sm font-bold">{notification.text}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-50"><X size={14} /></button>
        </div>
      )}

      {historySku && historyData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-bounce-in">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-4"><FileText className="text-indigo-400" /><div><h3 className="font-black">{historySku}</h3></div></div>
              <X className="cursor-pointer" onClick={() => setHistorySku(null)} />
            </div>
            <div className="flex-grow overflow-auto p-4">
              <table className="w-full text-xs">
                <thead><tr className="border-b"><th className="p-3 text-left">Дата</th><th className="p-3 text-left">Тип</th><th className="p-3 text-center">Шт</th><th className="p-3 text-right">На счет</th></tr></thead>
                <tbody>
                  {historyData.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-500">{r['Дата продажи'] || '---'}</td>
                      <td className="p-3">{r['Обоснование для оплаты']}</td>
                      <td className="p-3 text-center">{r['Кол-во']}</td>
                      <td className="p-3 text-right font-bold">{formatMoney(parseWBNum(r['К перечислению Продавцу за реализованный Товар']))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 text-center"><button onClick={() => setHistorySku(null)} className="px-8 py-2 bg-slate-900 text-white rounded-lg font-bold">Закрыть</button></div>
          </div>
        </div>
      )}

      {calcData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden animate-bounce-in">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold">Калькулятор: {calcData.art}</h3><X className="cursor-pointer" onClick={() => setCalcData(null)} /></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CalcInput label="Себест." value={calcData.cost} suffix="₽" onChange={v => setCalcData({ ...calcData, cost: v })} />
                <CalcInput label="Логистика" value={calcData.avgLogistics} suffix="₽" onChange={v => setCalcData({ ...calcData, avgLogistics: v })} />
                <CalcInput label="Прибыль" value={calcData.desiredProfit} suffix="₽" onChange={v => setCalcData({ ...calcData, desiredProfit: v })} />
                <CalcInput label="Комиссия %" value={calcData.commission} suffix="%" onChange={v => setCalcData({ ...calcData, commission: v })} highlight />
              </div>
              <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded-xl text-center">
                <div><p className="text-[10px] text-slate-400 font-bold">ЦЕНА САЙТА</p><p className="text-2xl font-black text-white">{formatMoney(calculatedResult.sitePrice)}</p></div>
                <div><p className="text-[10px] text-slate-400 font-bold">ЦЕНА СПП</p><p className="text-2xl font-black text-emerald-400">{formatMoney(calculatedResult.buyerPrice)}</p></div>
              </div>
              <button onClick={() => { localStorage.setItem('wb_locked_prices_v1', JSON.stringify({ ...savedPrices, [calcData.art]: calculatedResult.sitePrice })); setSavedPrices({ ...savedPrices, [calcData.art]: calculatedResult.sitePrice }); setCalcData(null); }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1500px] mx-auto p-4 md:p-8">
        <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3"><BarChart3 className="text-indigo-600" size={32} /><div><h1 className="text-xl font-black">WB ANALYST PREM</h1><p className="text-[10px] text-slate-400 font-bold uppercase">Multi-Report Analytical System</p></div></div>
          <div className="flex gap-2">
            <label className="bg-indigo-600 text-white px-4 py-2 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-2"><Upload size={14} /> Отчеты <input type="file" className="hidden" multiple accept=".xlsx" onChange={handleFileUpload} /></label>
            <label className="border border-emerald-500 text-emerald-600 px-4 py-2 rounded-lg cursor-pointer text-xs font-bold">Себестоимость <input type="file" className="hidden" accept=".xlsx" onChange={handleCostPriceUpload} /></label>
            {files.length > 0 && <button onClick={() => setFiles([])} className="text-rose-500 text-xs font-bold px-3">Очистить</button>}
          </div>
        </header>

        {files.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-20 text-center border-2 border-dashed border-slate-100"><Archive className="mx-auto text-slate-100 mb-4" size={60} /><p className="text-slate-400 font-black uppercase text-xs">Загрузите отчеты для начала работы</p></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <MiniStat title="К выплате" value={dashboardStats.toTransfer} color="emerald" icon={<TrendingUp size={14} />} />
              <MiniStat title="Логистика" value={dashboardStats.delivery} color="blue" icon={<Truck size={14} />} subValue={`${dashboardStats.deliveryCount} шт | ср. ${Math.round(dashboardStats.delivery / dashboardStats.deliveryCount || 0)} ₽`} />
              <MiniStat title="Штрафы" value={dashboardStats.fines} color="rose" icon={<ShieldAlert size={14} />} />
              <MiniStat title="Хранение" value={dashboardStats.storage} color="amber" icon={<Archive size={14} />} />
              <MiniStat title="Прочее" value={dashboardStats.withholdings + dashboardStats.acceptance} color="slate" icon={<ArrowDownCircle size={14} />} />
              <div className="bg-white p-4 rounded-xl border-2 border-indigo-600 flex flex-col justify-between"><span className="text-[9px] font-bold text-slate-400 uppercase">На счет</span><span className="text-lg font-black">{formatMoney(amountToBank)}</span></div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between"><span className="text-[9px] font-bold text-slate-400 uppercase">Себест.</span><span className="text-lg font-black">{formatMoney(totalCostForView)}</span></div>
              <div className="bg-indigo-600 p-4 rounded-xl text-white flex flex-col justify-between"><span className="text-[9px] font-bold opacity-80 uppercase">Прибыль</span><span className="text-lg font-black">{formatMoney(finalNet)}</span></div>
            </div>

            <div className="flex bg-white p-1 rounded-xl shadow-sm border w-fit">
              <TabBtn active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Сводка" />
              <TabBtn active={activeTab === 'articles'} onClick={() => setActiveTab('articles')} label="Артикулы" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden min-h-[400px]">
              {activeTab === 'summary' ? (
                <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b"><tr><th className="p-4">Тип</th><th className="p-4 text-right">К выплате</th><th className="p-4 text-right">Логистика</th></tr></thead>
                  <tbody>{Object.entries(summaryData).map(([t, v]) => (<tr key={t} className="border-b"><td className="p-4 font-bold">{t}</td><td className="p-4 text-right font-bold text-emerald-600">{formatMoney(v.toTransfer)}</td><td className="p-4 text-right text-slate-500">{formatMoney(v.delivery)}</td></tr>))}</tbody>
                </table></div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b"><tr><th className="p-4">Артикул</th><th className="p-4 text-center">Шт</th><th className="p-4 text-right">Ср. цена Пр.</th><th className="p-4 text-right">Прибыль (факт)</th><th className="p-4 text-right text-indigo-600">Прибыль (товар)</th><th className="p-4 text-right">Кальк.</th></tr></thead>
                  <tbody>
                    {Object.entries(allArticleStats).sort((a, b) => b[1].toSeller - a[1].toSeller).map(([art, vals]) => {
                      const wbCosts = vals.delivery + vals.fines + vals.storage + vals.withholdings + vals.acceptance;
                      const profitFact = vals.toSeller - wbCosts - (costPrices[art] || 0) * vals.count;
                      const avgLog = (vals.deliveryCount > 0 ? vals.delivery / vals.deliveryCount : 0);
                      const profitItem = vals.toSeller - (avgLog * vals.count) - (vals.fines + vals.storage + vals.withholdings + vals.acceptance) - (costPrices[art] || 0) * vals.count;
                      return (
                        <tr key={art} className="border-b hover:bg-slate-50">
                          <td className="p-4 font-black">{art}</td>
                          <td className="p-4 text-center font-bold">{vals.count}</td>
                          <td className="p-4 text-right">{formatMoney(vals.grossSalesCount > 0 ? vals.grossSalesSum / vals.grossSalesCount : 0)}</td>
                          <td className={`p-4 text-right font-bold ${profitFact < 0 ? 'text-rose-500' : 'text-slate-700'}`}>{formatMoney(profitFact)}</td>
                          <td className={`p-4 text-right font-black ${profitItem < 0 ? 'text-rose-500' : 'text-emerald-700'}`}>{formatMoney(profitItem)}</td>
                          <td className="p-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <FileText size={14} className="cursor-pointer text-slate-400" onClick={() => setHistorySku(art)} />
                              <Calculator size={14} className="cursor-pointer text-indigo-400" onClick={() => openCalculatorModal(art, vals)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes bounce-in { 0% { transform: scale(0.98); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default App;
