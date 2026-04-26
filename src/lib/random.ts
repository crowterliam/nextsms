// SPDX-License-Identifier: AGPL-3.0-or-later
// NextSMS — Next Soccer Management Simulator
// Copyright (C) 2026 NextSMS contributors
//
// Mersenne Twister MT19937 pseudorandom number generator
//
// Original copyright (C) 1997 Makoto Matsumoto and Takuji Nishimura
// Adapted for ESMS by Eli Bendersky, then ported to TypeScript for NextSMS
// Originally licensed under the GNU Library General Public License v2
// This file is licensed under the GNU Affero General Public License v3.0 or later
//
// Derived from: src/mt.cpp, src/mt.h (from https://github.com/eliben/esms)

const N = 624;
const M = 397;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const MAG01 = [0x0, 0x9908b0df];

export class MersenneTwister {
  private mt: Uint32Array;
  private mti: number;

  constructor(seed: number) {
    this.mt = new Uint32Array(N);
    this.mti = N;
    this.sgenrand(seed);
  }

  sgenrand(seed: number): void {
    this.mt[0] = seed >>> 0;
    for (this.mti = 1; this.mti < N; this.mti++) {
      this.mt[this.mti] = ((1812433253 * (this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30))) + this.mti) >>> 0;
    }
  }

  genrand(): number {
    if (this.mti >= N) {
      let kk: number;
      if (this.mti === N + 1) this.sgenrand(Date.now() & 0xffffffff);

      for (kk = 0; kk < N - M; kk++) {
        const y = (this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK);
        this.mt[kk] = this.mt[kk + M] ^ (y >>> 1) ^ MAG01[y & 0x1];
      }
      for (; kk < N - 1; kk++) {
        const y = (this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK);
        this.mt[kk] = this.mt[kk + (M - N)] ^ (y >>> 1) ^ MAG01[y & 0x1];
      }
      const y = (this.mt[N - 1] & UPPER_MASK) | (this.mt[0] & LOWER_MASK);
      this.mt[N - 1] = this.mt[M - 1] ^ (y >>> 1) ^ MAG01[y & 0x1];

      this.mti = 0;
    }

    let y = this.mt[this.mti++];

    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);

    return y >>> 0;
  }

  randomp(): number {
    return this.genrand() / 4294967296;
  }

  randomInt(max: number): number {
    return Math.floor(this.randomp() * max);
  }

  randomGaussian(mean: number, stdDev: number): number {
    const u1 = this.randomp();
    const u2 = this.randomp();
    const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    return Math.round(mean + z * stdDev);
  }

  randomRange(min: number, max: number): number {
    return min + Math.floor(this.randomp() * (max - min + 1));
  }
}
