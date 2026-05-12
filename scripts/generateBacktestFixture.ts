import { writeHistoricalFixture } from './backtestFixture.js';

const outputPath = writeHistoricalFixture();
console.log(`Wrote historical backtest fixture to ${outputPath}`);
