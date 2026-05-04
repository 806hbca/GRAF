/**
 * Транспортная задача: min Σ c_ij x_ij при Σ_j x_ij = a_i, Σ_i x_ij = b_j, x_ij ≥ 0.
 * Минимальная стоимость максимального потока; кратчайший путь — Bellman–Форд на остаточной сети.
 */
(function (global) {
    const EPS = 1e-9;

    class MinCostMaxFlow {
        constructor(n) {
            this.n = n;
            this.g = Array.from({ length: n }, () => []);
        }

        addEdge(from, to, cap, cost) {
            const fwd = { to, rev: this.g[to].length, cap, cost };
            const rev = { to: from, rev: this.g[from].length, cap: 0, cost: -cost };
            this.g[from].push(fwd);
            this.g[to].push(rev);
        }

        minCostFlow(s, t, maxf) {
            let flow = 0;
            let cost = 0;
            const n = this.n;
            const INF = 1e18;

            while (flow < maxf - EPS) {
                const dist = Array(n).fill(INF);
                const pv = Array(n).fill(-1);
                const pe = Array(n).fill(-1);
                dist[s] = 0;

                // До |V|-1 фаз BF; для устойчивости при отрицательных рёбрах в остаточной сети — 2|V| фаз
                for (let it = 0; it < 2 * n; it++) {
                    let updated = false;
                    for (let u = 0; u < n; u++) {
                        if (dist[u] >= INF / 2) continue;
                        for (let ei = 0; ei < this.g[u].length; ei++) {
                            const e = this.g[u][ei];
                            if (e.cap <= EPS) continue;
                            const nd = dist[u] + e.cost;
                            if (nd + EPS < dist[e.to]) {
                                dist[e.to] = nd;
                                pv[e.to] = u;
                                pe[e.to] = ei;
                                updated = true;
                            }
                        }
                    }
                    if (!updated) break;
                }

                if (dist[t] >= INF / 2) break;

                let add = maxf - flow;
                for (let v = t; v !== s; v = pv[v]) {
                    const e = this.g[pv[v]][pe[v]];
                    add = Math.min(add, e.cap);
                }
                for (let v = t; v !== s; v = pv[v]) {
                    const e = this.g[pv[v]][pe[v]];
                    const re = this.g[e.to][e.rev];
                    e.cap -= add;
                    re.cap += add;
                    cost += add * e.cost;
                }
                flow += add;
            }

            return { flow, cost };
        }
    }

    /**
     * @param {number[]} supplies
     * @param {number[]} demands
     * @param {number[][]} costs
     */
    function solveTransportProblem(supplies, demands, costs) {
        const m = supplies.length;
        const n = demands.length;
        if (m === 0 || n === 0) {
            throw new Error('Нужны хотя бы один поставщик и один потребитель');
        }
        if (costs.length !== m || costs.some((row) => row.length !== n)) {
            throw new Error(`Матрица стоимостей должна быть ${m}×${n}`);
        }

        let a = supplies.map((v) => Number(v));
        let b = demands.map((v) => Number(v));
        let c = costs.map((row) => row.map((v) => Number(v)));

        if (a.some((v) => v < -EPS) || b.some((v) => v < -EPS)) {
            throw new Error('Запасы и спросы должны быть неотрицательными');
        }

        const sumA = a.reduce((s, v) => s + v, 0);
        const sumB = b.reduce((s, v) => s + v, 0);
        let note = '';

        if (Math.abs(sumA - sumB) > 1e-6 * Math.max(1, sumA, sumB)) {
            if (sumA > sumB) {
                const d = sumA - sumB;
                b = b.concat(d);
                c = c.map((row) => row.concat(0));
                note = `Несбаланс: Σa > Σb. Фиктивный потребитель, спрос ${d.toFixed(4)}, тарифы 0.`;
            } else {
                const d = sumB - sumA;
                a = a.concat(d);
                c.push(Array(n).fill(0));
                note = `Несбаланс: Σb > Σa. Фиктивный поставщик, запас ${d.toFixed(4)}, тарифы 0.`;
            }
        }

        const m2 = a.length;
        const n2 = b.length;
        const S = 0;
        const offsetSupply = 1;
        const offsetDemand = 1 + m2;
        const T = 1 + m2 + n2;
        const nV = T + 1;

        const sumSend = a.reduce((s, v) => s + v, 0);
        const BIG = sumSend + 1;

        const mcf = new MinCostMaxFlow(nV);

        for (let i = 0; i < m2; i++) {
            mcf.addEdge(S, offsetSupply + i, a[i], 0);
        }
        for (let i = 0; i < m2; i++) {
            for (let j = 0; j < n2; j++) {
                mcf.addEdge(offsetSupply + i, offsetDemand + j, BIG, c[i][j]);
            }
        }
        for (let j = 0; j < n2; j++) {
            mcf.addEdge(offsetDemand + j, T, b[j], 0);
        }

        const { flow, cost } = mcf.minCostFlow(S, T, sumSend);

        if (Math.abs(flow - sumSend) > 1e-4 * Math.max(1, sumSend)) {
            throw new Error('Не удалось построить допустимый план (проверьте данные)');
        }

        const xExt = Array.from({ length: m2 }, () => Array(n2).fill(0));
        for (let i = 0; i < m2; i++) {
            const u = offsetSupply + i;
            for (const e of mcf.g[u]) {
                if (e.to < offsetDemand || e.to >= offsetDemand + n2) continue;
                const j = e.to - offsetDemand;
                const sent = BIG - e.cap;
                if (sent > EPS) xExt[i][j] = sent;
            }
        }

        const x = xExt.slice(0, m).map((row) => row.slice(0, n));

        return {
            x,
            xExtended: xExt,
            costExtended: c.map((row) => row.slice()),
            suppliesExtended: a.slice(),
            demandsExtended: b.slice(),
            totalCost: cost,
            balanced: note === '',
            note,
            mOrig: m,
            nOrig: n,
            mExt: m2,
            nExt: n2
        };
    }

    function transportExampleText() {
        return [
            '3 4',
            '14 5 8 7',
            '2 12 6 5',
            '8 4 6 5',
            '20 30 25',
            '10 15 20 30'
        ].join('\n');
    }

    global.solveTransportProblem = solveTransportProblem;
    global.transportExampleText = transportExampleText;
})(typeof window !== 'undefined' ? window : global);
