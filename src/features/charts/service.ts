import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { Chart, registerables } from 'chart.js';
import { Score, type ScoreDistribution } from '@/features/stats';
import type { LeaderboardEntry } from '@/features/leaderboard';
import * as repo from '@/features/charts/repository';
import { existsSync } from 'fs';

Chart.register(...registerables);

// Register system fonts for chart text rendering
const FONT_PATHS = [
  // Linux
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  // macOS
  '/System/Library/Fonts/Helvetica.ttc',
  '/Library/Fonts/Arial.ttf',
  // Windows
  'C:\\Windows\\Fonts\\arial.ttf',
];

let fontRegistered = false;
for (const fontPath of FONT_PATHS) {
  if (existsSync(fontPath)) {
    try {
      GlobalFonts.registerFromPath(fontPath, 'sans-serif');
      fontRegistered = true;
      break;
    } catch {
      // Continue to next font
    }
  }
}

// Set default font for Chart.js
Chart.defaults.font.family = fontRegistered ? 'sans-serif' : 'Arial';

export interface EloDataPoint {
  wordleNumber: number;
  elo: number;
}

export interface LeaderboardChartEntry {
  name: string;
  eloHistory: EloDataPoint[];
  currentElo: number;
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;
const WORDLE_GREEN = '#6aaa64';
const WORDLE_YELLOW = '#c9b458';
const WORDLE_GRAY = '#787c7e';
const TEXT_COLOR = '#ffffff';
const GRID_COLOR = '#444444';
const BG_COLOR = '#1a1a1a';

export async function generateDistributionChart(
  distribution: ScoreDistribution,
  username: string
): Promise<Buffer> {
  const canvas = createCanvas(CHART_WIDTH, CHART_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

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
          color: TEXT_COLOR,
        },
        legend: { display: false },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Guesses',
            color: TEXT_COLOR,
          },
          ticks: { color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
        y: {
          title: {
            display: true,
            text: 'Games',
            color: TEXT_COLOR,
          },
          beginAtZero: true,
          ticks: { stepSize: 1, color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
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

  // Fill background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

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
          color: TEXT_COLOR,
        },
        legend: { display: false },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Wordle #',
            color: TEXT_COLOR,
          },
          ticks: { color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
        y: {
          title: {
            display: true,
            text: 'Score',
            color: TEXT_COLOR,
          },
          reverse: true,
          min: 1,
          max: 6,
          ticks: { stepSize: 1, color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
      },
    },
  });

  chart.draw();
  const buffer = canvas.toBuffer('image/png');
  chart.destroy();
  return buffer;
}

// Line colors for different players
const LINE_COLORS = [
  '#6aaa64', // Green
  '#c9b458', // Yellow
  '#85c1e9', // Light blue
  '#f1948a', // Light red
  '#bb8fce', // Purple
  '#82e0aa', // Light green
  '#f8c471', // Orange
  '#aed6f1', // Pale blue
  '#f5b7b1', // Pink
  '#d7bde2', // Lavender
];

export async function generateLeaderboardChart(
  entries: LeaderboardChartEntry[],
  title: string
): Promise<Buffer> {
  const canvas = createCanvas(CHART_WIDTH, CHART_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

  const topEntries = entries.slice(0, 10);

  // Get all unique wordle numbers and sort them
  const allWordleNumbers = new Set<number>();
  for (const entry of topEntries) {
    for (const point of entry.eloHistory) {
      allWordleNumbers.add(point.wordleNumber);
    }
  }
  const sortedWordleNumbers = [...allWordleNumbers].sort((a, b) => a - b);

  // Take only the last 7 days
  const labels = sortedWordleNumbers.slice(-7).map((n) => `#${n}`);
  const wordleNumbersToShow = sortedWordleNumbers.slice(-7);

  // Create datasets for each player
  const datasets = topEntries.map((entry, index) => {
    const eloMap = new Map(entry.eloHistory.map((p) => [p.wordleNumber, p.elo]));
    const data = wordleNumbersToShow.map((wn) => eloMap.get(wn) ?? null);

    return {
      label: entry.name,
      data,
      borderColor: LINE_COLORS[index % LINE_COLORS.length],
      backgroundColor: LINE_COLORS[index % LINE_COLORS.length] + '40',
      fill: false,
      tension: 0.3,
      spanGaps: true,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const chart = new Chart(ctx as unknown as CanvasRenderingContext2D, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 18 },
          color: TEXT_COLOR,
        },
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: TEXT_COLOR,
            boxWidth: 12,
            padding: 8,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Wordle #',
            color: TEXT_COLOR,
          },
          ticks: { color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
        y: {
          title: {
            display: true,
            text: 'ELO Rating',
            color: TEXT_COLOR,
          },
          ticks: { color: TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
      },
    },
  });

  chart.draw();
  const buffer = canvas.toBuffer('image/png');
  chart.destroy();
  return buffer;
}
