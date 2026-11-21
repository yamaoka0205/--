// workers/spa.js
var spa_default = {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
export {
  spa_default as default
};
//# sourceMappingURL=spa.js.map
