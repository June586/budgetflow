export const COLORS = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#06B6D4","#EC4899","#84CC16","#F97316","#6366F1",
  "#14B8A6","#F43F5E","#A855F7","#0EA5E9","#22C55E",
]

export const PLATFORMS = [
  { id:"mb",      label:"MB Bank",      icon:"🏦", color:"#9333ea" },
  { id:"vcb",     label:"Vietcombank",  icon:"🏦", color:"#15803d" },
  { id:"tech",    label:"Techcombank",  icon:"🏦", color:"#dc2626" },
  { id:"acb",     label:"ACB",          icon:"🏦", color:"#0369a1" },
  { id:"bidv",    label:"BIDV",         icon:"🏦", color:"#1d4ed8" },
  { id:"agri",    label:"Agribank",     icon:"🏦", color:"#16a34a" },
  { id:"tpb",     label:"TPBank",       icon:"🏦", color:"#7c3aed" },
  { id:"momo",    label:"MoMo",         icon:"🌸", color:"#be185d" },
  { id:"zalo",    label:"ZaloPay",      icon:"💙", color:"#0284c7" },
  { id:"viettel", label:"ViettelPay",   icon:"📱", color:"#dc2626" },
  { id:"fund",    label:"Quỹ đầu tư",  icon:"📈", color:"#d97706" },
  { id:"gold",    label:"Vàng",         icon:"🥇", color:"#ca8a04" },
  { id:"cash",    label:"Tiền mặt",     icon:"💵", color:"#65a30d" },
  { id:"other",   label:"Khác",         icon:"📂", color:"#64748b" },
]

export const ACC_TYPES = [
  { id:"payment",    label:"TK Thanh toán" },
  { id:"saving",     label:"Sổ Tiết kiệm" },
  { id:"ewallet",    label:"Ví điện tử"   },
  { id:"investment", label:"Quỹ đầu tư"   },
  { id:"cash",       label:"Tiền mặt"     },
]

export const REPEAT_OPTIONS = [
  { id:"none",    label:"Không lặp"   },
  { id:"weekly",  label:"Hàng tuần"   },
  { id:"monthly", label:"Hàng tháng"  },
  { id:"yearly",  label:"Hàng năm"    },
]

export const CURRENT_MONTH = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}