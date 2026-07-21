// 卷心菜对账纯逻辑：token 状态机 + 可造法术力计算。页面只做渲染与手势，规则全在这里以便 Node 测试。

const TOKEN_KEYS = ['food', 'clue', 'treasure'];

function createCabbageState() {
  return {
    food: { u: 0, t: 0 },
    clue: { u: 0, t: 0 },
    treasure: { u: 0, t: 0 },
  };
}

function cloneState(state) {
  return {
    food: { u: state.food.u, t: state.food.t },
    clue: { u: state.clue.u, t: state.clue.t },
    treasure: { u: state.treasure.u, t: state.treasure.t },
  };
}

// 是否为该 token 追踪横置态：
// Food 恒追踪（Cabbage 要凑对未横置）；Clue/Treasure 仅在 Jaheira/Statuary 在场时追踪——
// 此时它们可横置产费（Jaheira 横置产 G、不牺牲；Statuary 征募抵泛用），需区分未横置/横置。
function tokenNeedsTap(tokenKey, engines) {
  const on = engines || {};
  if (tokenKey === 'food') return true;
  return Boolean(on.jaheira || on.statuary);
}

// 对手施放非生物咒语的产出。顺序①：先把本次要创建的 Food 全数算出，再让 Manufactor 三倍。
// - The Cabbage Merchant 在场造 1 个 Food；
// - Peregrin Took 在场、且本次有 token 产生（Cabbage 或 Manufactor 在场）时，再额外造 1 个 Food；
// - Academy Manufactor 在场时，对上面「每一个被创建的 Food」各补 1 Clue + 1 Treasure。
// 于是三件套里 Peregrin 那个 Food 也被 Manufactor 三倍 → Food/Clue/Treasure 各 2 个
//（旧写法把 Peregrin 的 Food 加在 Manufactor 之后，漏算了它对应的 1 Clue + 1 Treasure）。
function castTokens(state, engines) {
  const on = engines || {};
  const next = cloneState(state);

  const created = on.cabbage || on.manufactor;
  let food = 0;
  if (on.cabbage) food += 1;
  if (on.peregrin && created) food += 1;

  next.food.u += food;
  if (on.manufactor) {
    next.clue.u += food;
    next.treasure.u += food;
  }
  return next;
}

function addToken(state, tokenKey) {
  const next = cloneState(state);
  next[tokenKey].u += 1;
  return next;
}

// 横置一个（用于 Jaheira/Statuary 的产费或征募）；只对需要追踪横置的 token 生效。
function tapToken(state, tokenKey, engines) {
  if (!tokenNeedsTap(tokenKey, engines) || state[tokenKey].u <= 0) return state;
  const next = cloneState(state);
  next[tokenKey].u -= 1;
  next[tokenKey].t += 1;
  return next;
}

// 删减一个：优先删已横置，保住未横置的可用资源（要丢就丢榨过价值的）。
function removeToken(state, tokenKey) {
  const zone = state[tokenKey];
  if (zone.t <= 0 && zone.u <= 0) return state;
  const next = cloneState(state);
  if (next[tokenKey].t > 0) next[tokenKey].t -= 1;
  else next[tokenKey].u -= 1;
  return next;
}

// The Cabbage Merchant：横置 2 个未横置 Food → 1 绿（任意色，纯绿套牌按绿）。
function cabbageActivate(state) {
  if (state.food.u < 2) return state;
  const next = cloneState(state);
  next.food.u -= 2;
  next.food.t += 2;
  return next;
}

function cabbageAvailable(state) {
  return Math.floor(state.food.u / 2);
}

// 新回合：所有横置解开。
function untapAll(state) {
  const next = createCabbageState();
  TOKEN_KEYS.forEach((key) => {
    next[key].u = state[key].u + state[key].t;
    next[key].t = 0;
  });
  return next;
}

// Clock of Omens（横置两个其它神器 → 解横置目标神器）：解开 1 个已横置 Food，拿回去再凑对产费。
// 只解 1 个；没有已横置 Food 时不变（Clock 的费用是横置别的神器，不进食物账追踪）。
function untapOneFood(state) {
  if (state.food.t <= 0) return state;
  const next = cloneState(state);
  next.food.t -= 1;
  next.food.u += 1;
  return next;
}

// 可造法术力：绿（有色，优先）+ 泛用（Inspiring Statuary 征募，仅非神器咒语）。
// Treasure 作为独立的“可再产 N 绿”提示返回，不折进主数（牺牲/Jaheira 皆为未横置 Treasure 数）。
function calculateMana(state, engines) {
  const on = engines || {};
  const f = state.food.u;
  const c = state.clue.u;
  let green = 0;
  let generic = 0;

  // Food：Jaheira 每个产绿；否则 Cabbage 每 2 个产绿、单个零头落 Statuary 泛用；否则全落 Statuary 泛用。
  if (on.jaheira) {
    green += f;
  } else if (on.cabbage) {
    green += Math.floor(f / 2);
    if (on.statuary) generic += f % 2;
  } else if (on.statuary) {
    generic += f;
  }

  // Clue：只有 Jaheira 能横置产绿；否则 Statuary 抵泛用。
  if (on.jaheira) green += c;
  else if (on.statuary) generic += c;

  return { green, generic, treasure: state.treasure.u };
}

module.exports = {
  TOKEN_KEYS,
  createCabbageState,
  tokenNeedsTap,
  castTokens,
  addToken,
  tapToken,
  removeToken,
  cabbageActivate,
  cabbageAvailable,
  untapAll,
  untapOneFood,
  calculateMana,
};
