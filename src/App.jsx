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

const MiniStat = ({ title, value, color, icon }) => {
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
      <div className="text-lg font-black text-slate-800 tracking-tight leading-none">{formatMoney(value)}</div>
    </div>
  );
};

const SkuMiniStat = ({ label, value, color }) => {
  const colors = { indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700', rose: 'bg-rose-50 text-rose-700', slate: 'bg-slate-50 text-slate-700' };
  return (
    <div className={`p-3 rounded-2xl border border-black/5 ${colors[color]} shadow-sm`}>
      <div className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1 leading-none">{label}</div>
      <div className="text-sm font-black tracking-tight leading-none">{value}</div>
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

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => setLibReady(true);
    document.head.appendChild(script);

    const savedCosts = localStorage.getItem('wb_cost_prices_v4');
    if (savedCosts) setCostPrices(JSON.parse(savedCosts));

    const savedLocked = localStorage.getItem('wb_locked_prices_v1');
    if (savedLocked) setSavedPrices(JSON.parse(savedLocked));
  }, []);

  const persistSavedPrices = (newPrices) => {
    setSavedPrices(newPrices);
    localStorage.setItem('wb_locked_prices_v1', JSON.stringify(newPrices));
  };

  // --- Мемоизированные расчеты ---

  const filteredFilesList = useMemo(() => {
    if (!startDate && !endDate) return files;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return files.filter(file => file.rows.some(row => isRowInRange(row, start, end)));
  }, [files, startDate, endDate]);

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
    if (activeSku) {
      data = data.filter(r => getArt(r) === activeSku);
    }
    const stats = { realized: 0, toTransfer: 0, delivery: 0, fines: 0, storage: 0, withholdings: 0, acceptance: 0, count: 0 };
    data.forEach(row => {
      const type = row['Обоснование для оплаты'] || row['Тип документа'] || 'Прочее';
      let realized = parseWBNum(row['Вайлдберриз реализовал Товар (Пр)']);
      let toTransfer = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
      if (type === 'Возврат') { realized = -Math.abs(realized); toTransfer = -Math.abs(toTransfer); }

      stats.realized += realized;
      stats.toTransfer += toTransfer;
      stats.delivery += parseWBNum(row['Услуги по доставке товара покупателю']);
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
      if (!articles[art]) articles[art] = { count: 0, revenue: 0, toSeller: 0, delivery: 0, fines: 0, storage: 0, withholdings: 0, acceptance: 0, returnCount: 0, kvvSum: 0, kvvCount: 0, acqSum: 0, acqCount: 0 };
      const type = row['Обоснование для оплаты'];
      const count = parseInt(row['Кол-во']) || 0;
      let realized = parseWBNum(row['Вайлдберриз реализовал Товар (Пр)']);
      let toTransfer = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
      if (type === 'Возврат') { realized = -Math.abs(realized); toTransfer = -Math.abs(toTransfer); articles[art].returnCount += count; }
      if (type === 'Продажа') { articles[art].count += count; }
      else if (type === 'Возврат') { articles[art].count -= count; }
      articles[art].revenue += realized;
      articles[art].toSeller += toTransfer;
      articles[art].delivery += parseWBNum(row['Услуги по доставке товара покупателю']);
      articles[art].fines += parseWBNum(row['Общая сумма штрафов']);
      articles[art].storage += parseWBNum(row['Хранение'] || row['Сумма по полю Хранение']);
      articles[art].withholdings += parseWBNum(row['Удержания'] || row['Сумма по полю Удержания']);
      articles[art].acceptance += parseWBNum(row['Операции на приемке'] || row['Сумма по полю Операции на приемке']);
      const kvv = parseWBNum(row['Размер кВВ, %']);
      const acq = parseWBNum(row['Размер комиссии за эквайринг/Комиссии за организацию платежей, %']);
      if (kvv !== 0) { articles[art].kvvSum += kvv; articles[art].kvvCount++; }
      if (acq !== 0) { articles[art].acqSum += acq; articles[art].acqCount++; }
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
      stats[type].realized += realized;
      stats[type].toTransfer += toTransfer;
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

  // --- Обработчики ---

  const handleClearAll = () => {
    setFiles([]);
    setSelectedFileId('total');
    setActiveSku(null);
    setSavedPrices({});
    setStartDate('');
    setEndDate('');
    localStorage.removeItem('wb_locked_prices_v1');
    setNotification({ type: 'success', text: 'Данные очищены.' });
  };

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    if (uploadedFiles.length === 0 || !libReady) return;
    setIsLoading(true);
    const newFilesData = [];
    for (const file of uploadedFiles) {
      const data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const bstr = e.target.result;
            const wb = window.XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawData = window.XLSX.utils.sheet_to_json(ws);
            resolve(rawData);
          } catch (err) { resolve(null); }
        };
        reader.readAsBinaryString(file);
      });
      if (data && data.length > 0) {
        let extractedNumber = '';
        const nameMatch = file.name.match(/№(\d+)/);
        if (nameMatch) extractedNumber = nameMatch[1];
        else extractedNumber = data[0]['№'] || data[0]['Номер отчета'] || data[0]['n'] || file.name.split('.')[0];
        newFilesData.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, reportNumber: String(extractedNumber).trim(), rows: data });
      }
    }
    const updatedFiles = [...files, ...newFilesData];
    setFiles(updatedFiles);
    if (updatedFiles.length > 0 && !startDate) {
      let minD = null, maxD = null;
      updatedFiles.flatMap(f => f.rows).forEach(r => {
        const d = parseWBDate(r['Дата продажи'] || r['Дата']);
        if (d) { if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d; }
      });
      if (minD) setStartDate(formatDateForInput(minD));
      if (maxD) setEndDate(formatDateForInput(maxD));
    }
    setIsLoading(false);
    event.target.value = null;
  };

  const handleCostPriceUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !libReady) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = window.XLSX.utils.sheet_to_json(ws);
        const newCosts = { ...costPrices };
        let count = 0;
        rawData.forEach(row => {
          const art = getArt(row);
          const costKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'себестоимость' || k.toLowerCase().includes('цена закуп'));
          if (art && costKey) {
            const cost = parseWBNum(row[costKey]);
            if (cost) { newCosts[art] = cost; count++; }
          }
        });
        setCostPrices(newCosts);
        localStorage.setItem('wb_cost_prices_v4', JSON.stringify(newCosts));
        setNotification({ type: 'success', text: `Загружено ${count} цен.` });
      } catch (err) { setNotification({ type: 'error', text: 'Ошибка файла.' }); }
      finally { setIsLoading(false); event.target.value = null; }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadArticles = () => {
    if (!libReady || files.length === 0) return;
    const allArticlesMap = new Map();
    files.forEach(file => file.rows.forEach(row => {
      const art = getArt(row);
      if (art) allArticlesMap.set(art, costPrices[art] || '');
    }));
    const sortedArticles = Array.from(allArticlesMap.keys()).sort();
    const wsData = [['Артикул', 'Себестоимость'], ...sortedArticles.map(art => [art, allArticlesMap.get(art)])];
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    window.XLSX.utils.book_append_sheet(wb, ws, "Артикулы");
    window.XLSX.writeFile(wb, "Артикулы_себестоимость.xlsx");
  };

  const handleDownloadPriceUpdate = () => {
    if (!libReady || Object.keys(savedPrices).length === 0) return;
    const metadataMap = new Map();
    files.forEach(f => f.rows.forEach(r => {
      const sArt = getArt(r);
      const wbId = String(r['Код номенклатуры'] || '').trim();
      if (sArt && wbId && savedPrices[sArt] && !metadataMap.has(wbId)) {
        metadataMap.set(wbId, { brand: r['Бренд'] || '', cat: r['Предмет'] || '', wb: wbId, sel: sArt, bc: r['Баркод'] || '', pr: parseWBNum(r['Цена розничная с учетом согласованной скидки']), res: savedPrices[sArt] });
      }
    }));
    const headers = ['Бренд', 'Категория', 'Артикул WB', 'Артикул продавца', 'Последний баркод', 'Остатки WB', 'Остатки продавца', 'Оборачиваемость', 'Цена со скидкой', 'Текущая минимальная цена для применения скидки по автоакции', 'Новая минимальная цена для применения скидки по автоакции', 'Текущая блокировка применения скидки по автоакции', 'Новая блокировка применения скидки по автоакции'];
    const wsData = [headers, ...Array.from(metadataMap.values()).map(m => [m.brand, m.cat, m.wb, m.sel, m.bc, 0, 0, 0, m.pr, 0, m.res, 'Нет', 'Бессрочно'])];
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    window.XLSX.utils.book_append_sheet(wb, ws, "Минимальная цена");
    window.XLSX.writeFile(wb, "Блокировка_автоакций.xlsx");
  };

  const handleDownloadChangePrices = () => {
    if (!libReady || Object.keys(savedPrices).length === 0) return;
    const items = new Map();
    files.forEach(f => f.rows.forEach(r => {
      const sArt = getArt(r);
      const wbId = String(r['Код номенклатуры'] || '').trim();
      if (sArt && wbId && savedPrices[sArt] && !items.has(wbId)) {
        items.set(wbId, [r['Бренд'], r['Предмет'], wbId, sArt, r['Баркод'], 0, 0, '', parseWBNum(r['Цена розничная']), Math.ceil(savedPrices[sArt] / 0.7), parseWBNum(r['Итоговая согласованная скидка, %']), 30, '', '', '']);
      }
    }));
    const headers = ['Бренд', 'Категория', 'Артикул WB', 'Артикул продавца', 'Последний баркод', 'Остатки WB', 'Остатки продавца', 'Оборачиваемость', 'Текущая цена', 'Новая цена', 'Текущая скидка', 'Новая скидка', 'Цена со скидкой', 'Привлекательная цена', 'Наличие ошибки'];
    const wsData = [headers, ...Array.from(items.values())];
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    window.XLSX.utils.book_append_sheet(wb, ws, "prices");
    window.XLSX.writeFile(wb, "Изменение_цен.xlsx");
  };

  const resetPeriod = () => {
    let minD = null, maxD = null;
    files.flatMap(f => f.rows).forEach(r => {
      const d = parseWBDate(r['Дата продажи'] || r['Дата']);
      if (d) { if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d; }
    });
    setStartDate(formatDateForInput(minD));
    setEndDate(formatDateForInput(maxD));
  };

  const openCalculatorModal = (art, stats) => {
    const totalUnits = Math.abs(stats.count) + Math.abs(stats.returnCount);
    const avgLog = totalUnits > 0 ? (stats.delivery / totalUnits) : 0;
    const avgComm = stats.kvvCount > 0 ? (stats.kvvSum / stats.kvvCount) : 20;
    const avgAcq = stats.acqCount > 0 ? (stats.acqSum / stats.acqCount) : 2;
    setCalcData({ art, cost: costPrices[art] || 0, avgLogistics: Math.round(avgLog), commission: parseFloat(avgComm.toFixed(2)), acquiring: parseFloat(avgAcq.toFixed(2)), tax: 6, other: 50, desiredProfit: 300, spp: 15 });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 pb-12 transition-all text-left">
      {notification && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-in border-l-4 ${notification.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' : 'bg-white border-rose-500 text-rose-800'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-rose-500" />}
          <span className="text-sm font-bold">{notification.text}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      {/* Модальное окно истории */}
      {historySku && historyData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-bounce-in">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <FileText size={24} className="text-indigo-400" />
                <div><h3 className="text-lg font-black">{historySku}</h3><p className="text-[10px] uppercase font-bold opacity-60">История всех операций</p></div>
              </div>
              <button onClick={() => setHistorySku(null)} className="p-2 hover:bg-white/10 rounded-xl"><X /></button>
            </div>
            <div className="flex-grow overflow-auto p-4 font-sans">
              <table className="w-full text-sm border-collapse font-sans">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left">Дата</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left">Операция</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">Шт</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">На счет</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">Логистика</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {historyData.map((row, i) => {
                    const type = row['Обоснование для оплаты'] || row['Тип документа'];
                    const toWB = parseWBNum(row['К перечислению Продавцу за реализованный Товар']);
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors text-left">
                        <td className="p-4 text-xs font-bold text-slate-500">{row['Дата продажи'] || '---'}</td>
                        <td className="p-4 text-xs"><span className={`px-2 py-0.5 rounded-lg font-bold border ${type === 'Возврат' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{type}</span></td>
                        <td className="p-4 text-center font-bold">{row['Кол-во']}</td>
                        <td className={`p-4 text-right font-black ${toWB < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{formatMoney(toWB)}</td>
                        <td className="p-4 text-right text-blue-500 font-bold">{formatMoney(parseWBNum(row['Услуги по доставке товара покупателю']))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center shrink-0 font-sans"><button onClick={() => setHistorySku(null)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">Закрыть</button></div>
          </div>
        </div>
      )}

      {/* Модальное окно калькулятора */}
      {calcData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto font-sans">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-bounce-in my-8">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3"><Calculator size={24} /><h3 className="text-lg font-bold">Умный калькулятор цен</h3></div>
              <button onClick={() => setCalcData(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Артикул: {calcData.art}</div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-4 text-left">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Затраты</h4>
                  <CalcInput label="Себестоимость" value={calcData.cost} suffix="₽" onChange={v => setCalcData({ ...calcData, cost: v })} />
                  <CalcInput label="Логистика (ср.)" value={calcData.avgLogistics} suffix="₽" onChange={v => setCalcData({ ...calcData, avgLogistics: v })} />
                  <CalcInput label="Прибыль (жел.)" value={calcData.desiredProfit} suffix="₽" onChange={v => setCalcData({ ...calcData, desiredProfit: v })} />
                </div>
                <div className="space-y-4 text-left">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Тарифы</h4>
                  <CalcInput label="Комиссия WB" value={calcData.commission} suffix="%" onChange={v => setCalcData({ ...calcData, commission: v })} highlight />
                  <CalcInput label="Эквайринг" value={calcData.acquiring} suffix="%" onChange={v => setCalcData({ ...calcData, acquiring: v })} highlight />
                  <CalcInput label="Ваш налог" value={calcData.tax} suffix="%" onChange={v => setCalcData({ ...calcData, tax: v })} />
                  <CalcInput label="СПП (%)" value={calcData.spp} suffix="%" onChange={v => setCalcData({ ...calcData, spp: v })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex flex-col items-center shadow-lg"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Цена сайта</span><span className="text-3xl font-black">{formatMoney(calculatedResult.sitePrice)}</span></div>
                <div className="p-6 bg-emerald-500 rounded-[2rem] text-white flex flex-col items-center shadow-lg"><span className="text-[9px] font-bold text-emerald-100 uppercase tracking-widest mb-1">Цена СПП</span><span className="text-3xl font-black">{formatMoney(calculatedResult.buyerPrice)}</span></div>
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              <button onClick={() => { persistSavedPrices({ ...savedPrices, [calcData.art]: calculatedResult.sitePrice }); setNotification({ type: 'success', text: `Цена сохранена.` }); }} className="py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"><Save size={18} /> Сохранить</button>
              <button onClick={() => setCalcData(null)} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="max-w-[1500px] mx-auto p-4 md:p-8">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200"><BarChart3 className="text-white" size={28} /></div>
            <div><h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">WB Аналитик Multi</h1><p className="text-slate-400 text-sm font-medium">Анализ прибыли и управление ценами</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-sm font-bold text-sm ${!libReady || isLoading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              <span>Добавить отчеты</span>
              <input type="file" className="hidden" accept=".xlsx,.xls" multiple onChange={handleFileUpload} disabled={!libReady || isLoading} />
            </label>
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-sm font-bold text-sm border-2 ${!libReady || isLoading ? 'border-slate-200 text-slate-300' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}>
              <Coins size={18} /><span>Себестоимость</span>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleCostPriceUpload} disabled={!libReady || isLoading} />
            </label>
            {files.length > 0 && (<button onClick={handleClearAll} className="px-3 py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl font-bold text-sm border border-transparent hover:border-rose-100 transition-all">Очистить</button>)}
          </div>
        </header>

        {files.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center shadow-sm">
            <Archive className="text-indigo-100 mx-auto mb-6" size={80} /><h2 className="text-2xl font-black text-slate-800 mb-2">Загрузите отчеты</h2>
            <p className="text-slate-500 max-w-sm mx-auto text-center font-medium leading-relaxed">Выберите файлы .xlsx для формирования аналитики.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col gap-1 text-left">
                <div className="flex items-center gap-2 text-indigo-600"><Calendar size={18} /><h3 className="text-sm font-black uppercase tracking-widest">Период анализа</h3></div>
                <p className="text-[10px] text-slate-400 font-bold ml-7 tracking-wider uppercase">Все цифры рассчитаны за этот период</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-indigo-900 outline-none focus:border-indigo-400 shadow-sm" />
                  <ArrowRight size={16} className="text-slate-300 mx-1" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-indigo-900 outline-none focus:border-indigo-400 shadow-sm" />
                </div>
                <button onClick={resetPeriod} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><RefreshCcw size={16} /></button>
              </div>
            </div>

            {/* Selector status */}
            <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-200/40 rounded-2xl w-fit shadow-inner">
              <button onClick={() => { setSelectedFileId('total'); setActiveSku(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${selectedFileId === 'total' && !activeSku ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                <Layers size={14} />Все отчеты ({filteredFilesList.length})
              </button>
              <div className="w-[1px] h-4 bg-slate-300 mx-1" />
              {filteredFilesList.map(file => (
                <div key={file.id} className="flex items-center gap-1 group bg-white/40 rounded-xl pr-1 shadow-sm border border-slate-100">
                  <button onClick={() => setSelectedFileId(file.id)} className={`px-4 py-2 text-xs font-bold transition-all ${selectedFileId === file.id ? 'text-indigo-600' : 'text-slate-400'}`}><Hash size={12} className="inline opacity-50 mr-1" />{file.reportNumber}</button>
                  <button onClick={() => { setFiles(prev => prev.filter(f => f.id !== file.id)); if (selectedFileId === file.id) setSelectedFileId('total'); }} className="p-1 text-slate-300 hover:text-rose-50 transition-colors mr-1"><X size={14} /></button>
                </div>
              ))}
            </div>

            {/* SKU Specific Badge */}
            {activeSku && (
              <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl flex items-center justify-between shadow-lg animate-bounce-in">
                <div className="flex items-center gap-3"><Package size={20} /><div><span className="text-[10px] uppercase font-black opacity-70">Аналитика по артикулу:</span><h4 className="text-sm font-black mt-1 leading-none">{activeSku}</h4></div></div>
                <button onClick={() => setActiveSku(null)} className="bg-white/20 hover:bg-white/30 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition-all"><X size={14} /> Сбросить</button>
              </div>
            )}

            {/* Dashboard Stats (8 КАРТОЧЕК) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 transition-all duration-500">
              <MiniStat title="К перечислению" value={dashboardStats.toTransfer} color="emerald" icon={<TrendingUp size={14} />} />
              <MiniStat title="Логистика" value={dashboardStats.delivery} color="blue" icon={<Truck size={14} />} />
              <MiniStat title="Штрафы" value={dashboardStats.fines} color="rose" icon={<ShieldAlert size={14} />} />
              <MiniStat title="Хранение" value={dashboardStats.storage} color="amber" icon={<Archive size={14} />} />
              <MiniStat title="Прочее" value={dashboardStats.withholdings + dashboardStats.acceptance} color="slate" icon={<ArrowDownCircle size={14} />} />

              <div className="bg-white p-4 rounded-2xl border-2 border-indigo-600 shadow-lg flex flex-col justify-between min-h-[100px] text-left relative overflow-hidden text-indigo-900 font-black">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Итого на счет</span>
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500"><Wallet size={14} /></div>
                </div>
                <div className="text-lg tracking-tight leading-none">{formatMoney(amountToBank)}</div>
              </div>

              {/* ОКНО: СЕБЕСТОИМОСТЬ */}
              <div className="bg-white p-4 rounded-2xl border-2 border-slate-300 shadow-lg flex flex-col justify-between min-h-[100px] text-left relative overflow-hidden text-slate-700 font-black">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Себестоимость</span>
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600"><Coins size={14} /></div>
                </div>
                <div className="text-lg tracking-tight leading-none">{formatMoney(totalCostForView)}</div>
              </div>

              <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl flex flex-col justify-between overflow-hidden relative">
                <span className="text-[10px] font-bold uppercase opacity-80 tracking-widest z-10 leading-none">Прибыль (нетто)</span>
                <span className="text-xl font-black tracking-tight z-10 leading-none">{formatMoney(finalNet)}</span>
                <Package className="absolute -right-4 -bottom-4 opacity-10 rotate-12" size={70} />
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <button onClick={handleDownloadArticles} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"><Download size={14} /> Артикулы</button>
              <div className="w-[1px] h-6 bg-slate-100 mx-2" />
              <button onClick={handleDownloadPriceUpdate} className={`flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all ${Object.keys(savedPrices).length === 0 ? 'opacity-50 pointer-events-none' : ''}`}><Lock size={14} /> Блокировка</button>
              <button onClick={handleDownloadChangePrices} className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all ${Object.keys(savedPrices).length === 0 ? 'opacity-50 pointer-events-none' : ''}`}><Tag size={14} /> Изменение цен</button>
            </div>

            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 w-fit font-sans">
              <TabBtn active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Сводка операций" />
              <TabBtn active={activeTab === 'articles'} onClick={() => setActiveTab('articles')} label="Анализ артикулов" />
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
              {currentDataFiltered.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center text-slate-300 font-sans"><Filter size={48} className="mb-4" /><h3 className="font-bold uppercase text-xs tracking-widest leading-none text-slate-400">Данные отсутствуют</h3></div>
              ) : activeTab === 'summary' ? (
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Тип операции</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">К выплате</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Логистика</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-rose-300">Расходы</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                      {Object.entries(summaryData).map(([type, vals]) => (
                        <tr key={type} className="hover:bg-slate-50/80 transition-colors text-left font-black">
                          <td className="p-5 flex items-center gap-2 text-slate-700">{type}{type === 'Возврат' && <RefreshCcw size={12} className="text-rose-400" />}</td>
                          <td className={`p-5 text-right ${vals.toTransfer < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{formatMoney(vals.toTransfer)}</td>
                          <td className="p-5 text-right text-slate-500">{formatMoney(vals.delivery)}</td>
                          <td className="p-5 text-right text-slate-400">{formatMoney(vals.fines + vals.storage + vals.withholdings + vals.acceptance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto text-sm font-sans">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead className="bg-slate-50/50 border-b border-slate-100 font-sans">
                      <tr><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Артикул</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center font-sans">Шт.</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right font-sans">На счет</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-rose-400 font-sans">Расходы</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right text-indigo-500 font-black font-sans">Цена сайта</th><th className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right font-sans">Прибыль</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-left font-sans">
                      {Object.entries(allArticleStats).sort((a, b) => b[1].toSeller - a[1].toSeller).map(([art, vals]) => {
                        const wbCosts = vals.delivery + vals.fines + vals.storage + vals.withholdings + vals.acceptance;
                        const profit = vals.toSeller - wbCosts - ((costPrices[art] || 0) * vals.count);
                        const isLocked = savedPrices.hasOwnProperty(art);
                        const isCurrentActive = activeSku === art;
                        return (
                          <tr key={art} className={`hover:bg-indigo-50/30 transition-colors group cursor-pointer font-sans ${isCurrentActive ? 'bg-indigo-50/60 border-l-4 border-indigo-500' : ''}`} onClick={() => setActiveSku(isCurrentActive ? null : art)}>
                            <td className="p-5 text-left font-black text-slate-700">
                              <div className="flex items-center gap-2"><span className={`transition-all font-sans ${isCurrentActive ? 'text-indigo-600 scale-105 underline underline-offset-4' : 'text-indigo-900 group-hover:text-indigo-600'}`}>{art}</span>{isLocked && <div className="p-1 bg-emerald-100 text-emerald-600 rounded-full shadow-sm"><CheckCircle2 size={10} /></div>}</div>
                              {vals.returnCount > 0 && <span className="text-[9px] text-rose-400 font-bold uppercase tracking-tighter leading-none font-sans">Возвратов: {vals.returnCount}</span>}
                            </td>
                            <td className="p-5 text-center font-black text-indigo-600 tracking-tighter text-base leading-none font-sans">{vals.count}</td>
                            <td className={`p-5 text-right font-bold leading-none font-sans ${vals.toSeller < 0 ? 'text-rose-500' : 'text-slate-800'}`}>{formatMoney(vals.toSeller)}</td>
                            <td className="p-5 text-right text-rose-400 text-xs leading-none font-bold font-sans">-{formatMoney(wbCosts)}</td>
                            <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 justify-end">
                                <button onClick={() => setHistorySku(art)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm"><FileText size={14} /></button>
                                <button onClick={() => openCalculatorModal(art, vals)} className={`p-1.5 rounded-lg transition-all ${isLocked ? 'bg-emerald-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}><Calculator size={14} /></button>
                              </div>
                            </td>
                            <td className={`p-5 text-right font-black text-base leading-none font-sans ${profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(profit)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
