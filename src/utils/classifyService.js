const HARD_KW = [
  'ahu','fcu','pump','cctv','fan','hv ','switchgear','chiller','cooling tower',
  'db-','lift','escalator','fire','pipe','drain','hvac','electrical pm','plumbing',
  'boiler','generator','ups','bms','acs','socket','lighting','ventilation',
  'compressor','thermostat','mechanical','electrical','engineering',
];
const SOFT_KW = [
  'pest','cleaning','housekeep','security','waste','landscape','garden',
  'janitorial','sanitiz','uniform','receptionist','parking attend',
  'signage','access card','cosmetic','concierge',
];

export function classifyService(r) {
  const hay = [r.asset, r.eventType, r.problemType, r.category].join(' ').toLowerCase();
  if (SOFT_KW.some(k => hay.includes(k))) return 'Soft';
  if (HARD_KW.some(k => hay.includes(k))) return 'Hard';
  return 'Hard';
}
