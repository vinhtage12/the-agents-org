import { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';

import { Appearance, TmnBox, TmnText, useTheme } from '@truyenmoinhu/uikit';

Chart.register(
  ArcElement,
  DoughnutController,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);
interface Props {
  title: string;
  labels: string[];
  values: (number | null)[];
  type?: 'doughnut' | 'bar';
  percent?: boolean;
}
export default function MetricChart({
  title,
  labels,
  values,
  type = 'doughnut',
  percent = true
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { appearance } = useTheme();
  useEffect(() => {
    if (!ref.current) return;
    const color = appearance === Appearance.DARK ? '#e2e8f0' : '#334155';
    const chart = new Chart(ref.current, {
      type,
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
            backgroundColor:
              type === 'doughnut'
                ? ['#4f8750', '#d6e4d5']
                : ['#4f8750', '#5486c4', '#a777be', '#d79a42'],
            borderWidth: 0,
            borderRadius: type === 'bar' ? 4 : 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        color,
        plugins: {
          legend: {
            display: type === 'doughnut',
            position: 'bottom',
            labels: { color, boxWidth: 10, font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: context =>
                `${context.label}: ${context.raw}${percent ? '%' : ''}`
            }
          }
        },
        ...(type === 'bar'
          ? {
              scales: {
                x: {
                  ticks: { color, font: { size: 10 } },
                  grid: { display: false }
                },
                y: {
                  beginAtZero: true,
                  ticks: { color },
                  grid: {
                    color:
                      appearance === Appearance.DARK ? '#334155' : '#e2e8f0'
                  }
                }
              }
            }
          : { cutout: '72%' })
      }
    });
    return () => chart.destroy();
  }, [title, labels, values, type, percent, appearance]);
  return (
    <TmnBox>
      <TmnText as="p" size="2" weight="medium" className="mb-2">
        {title}
      </TmnText>
      <TmnBox className="relative h-40 w-full">
        <canvas
          ref={ref}
          role="img"
          aria-label={`${title}: ${labels.map((label, index) => `${label}: ${values[index] ?? '—'}${percent ? '%' : ''}`).join(', ')}`}
        />
      </TmnBox>
    </TmnBox>
  );
}
