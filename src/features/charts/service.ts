import { createCanvas } from '@napi-rs/canvas';
import { Chart, registerables } from 'chart.js';
import { Score, type ScoreDistribution } from '@/features/stats';
import * as repo from '@/features/charts/repository';

Chart.register(...registerables);

const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;
const WORDLE_GREEN = '#6aaa64';
const WORDLE_YELLOW = '#c9b458';
const WORDLE_GRAY = '#787c7e';

export async function generateDistributionChart(
  distribution: ScoreDistribution,
  username: string
): Promise<Buffer> {
  const canvas = createCanvas(CHART_WIDTH, CHART_HEIGHT);
  const ctx = canvas.getContext('2d');

  const labels = ['1', '2', '3', '4', '5', '6', 'X'];
  const data = [
    distribution[Score.One],
    distribution[Score.Two],
    distribution[Score.Three],
    distribution[Score.Four],
    distribution[Score.Five],
    distribution[Score.Six],
    distribution[Score.Fail],
  ];

  const chart = new Chart(ctx as unknown as CanvasRenderingContext2D, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Games',
          data,
          backgroundColor: [
            WORDLE_GREEN,
            WORDLE_GREEN,
            WORDLE_GREEN,
            WORDLE_YELLOW,
            WORDLE_YELLOW,
            WORDLE_GRAY,
            '#ff6b6b',
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: `${username}'s Score Distribution`,
          font: { size: 18 },
          color: '#000',
        },
        legend: { display: false },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Guesses',
            color: '#000',
          },
          ticks: { color: '#000' },
          grid: { color: '#e0e0e0' },
        },
        y: {
          title: {
            display: true,
            text: 'Games',
            color: '#000',
          },
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#000' },
          grid: { color: '#e0e0e0' },
        },
      },
    },
  });

  chart.draw();
  const buffer = canvas.toBuffer('image/png');
  chart.destroy();
  return buffer;
}

export async function generateTrendChart(
  userId: number,
  username: string
): Promise<Buffer> {
  const games = await repo.findRecentGamesByUserId(userId);
  const canvas = createCanvas(CHART_WIDTH, CHART_HEIGHT);
  const ctx = canvas.getContext('2d');

  const sortedGames = [...games].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
  );

  const labels = sortedGames.map((g) => `#${g.wordleNumber}`);
  const data = sortedGames.map((g) => (g.score === Score.Fail ? null : g.score));

  const chart = new Chart(ctx as unknown as CanvasRenderingContext2D, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score',
          data,
          borderColor: WORDLE_GREEN,
          backgroundColor: WORDLE_GREEN + '40',
          fill: true,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: `${username}'s Score Trend`,
          font: { size: 18 },
          color: '#000',
        },
        legend: { display: false },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Wordle #',
            color: '#000',
          },
          ticks: { color: '#000' },
          grid: { color: '#e0e0e0' },
        },
        y: {
          title: {
            display: true,
            text: 'Score',
            color: '#000',
          },
          reverse: true,
          min: 1,
          max: 6,
          ticks: { stepSize: 1, color: '#000' },
          grid: { color: '#e0e0e0' },
        },
      },
    },
  });

  chart.draw();
  const buffer = canvas.toBuffer('image/png');
  chart.destroy();
  return buffer;
}
