"""Render the checked-in synthetic evidence; never read live hardware data.

Optional documentation tool: requires matplotlib. Run from any directory.
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
fixture = json.loads((ROOT / 'dist/demo-data.json').read_text())
records = sorted(fixture['details'].values(), key=lambda item: item['checkpoint'])
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})
fig, axes = plt.subplots(1, 3, figsize=(15, 5.6), sharey=True)
fig.patch.set_facecolor('#f6f7f9')
fig.suptitle('ONE PASS. ONE PIECE OF EVIDENCE.', x=.055, y=.96,
             ha='left', fontsize=23, fontweight='bold', color='#111820')
fig.text(.055, .865, 'Synthetic fixture waveforms | 121 samples per pass | 50 ms spacing | no measured GPS',
         color='#5d6572', fontsize=11)
for ax, record in zip(axes, records):
    samples = record['samples']
    times = [(sample['measured'] - samples[0]['measured']) / 1000 for sample in samples]
    impact = [sample['impact'] for sample in samples]
    ax.set_facecolor('white')
    ax.axhspan(.6, 1.25, color='#c6443d', alpha=.055)
    ax.axhspan(.2, .6, color='#c98e28', alpha=.065)
    ax.axhline(.2, color='#c98e28', linestyle='--', linewidth=1)
    ax.axhline(.6, color='#c6443d', linestyle='--', linewidth=1)
    ax.plot(times, impact, color='#234dff', linewidth=1.8)
    ax.fill_between(times, impact, color='#234dff', alpha=.055)
    peak_index = impact.index(max(impact))
    ax.scatter(times[peak_index], impact[peak_index], s=30, color='#234dff', zorder=4)
    ax.annotate(f"{max(impact):.3f} g", (times[peak_index], impact[peak_index]),
                xytext=(10, 8), textcoords='offset points', color='#162b84', fontsize=11)
    ax.set_title(f"{record['checkpoint']} / {record['location']['name']}", loc='left',
                 fontsize=12, fontweight='bold', pad=14)
    ax.set_xlim(0, 6); ax.set_ylim(0, 1.25)
    ax.set_xlabel('Time into pass (seconds)', labelpad=10, color='#5d6572')
    ax.set_yticks([0, .2, .4, .6, .8, 1, 1.2])
    ax.grid(axis='y', color='#dfe3e9', linewidth=.5)
    ax.set_axisbelow(True)
    ax.spines[['top', 'right']].set_visible(False)
    ax.spines[['left', 'bottom']].set_color('#c7cdd5')
    ax.tick_params(colors='#5d6572')
axes[0].set_ylabel('Impact magnitude deviation (g)', labelpad=10, color='#5d6572')
fig.text(.055, .075, 'DASHED THRESHOLDS  |  Amber > 0.20 g  |  Red > 0.60 g', fontsize=11, color='#333d4b')
fig.text(.055, .027, 'Generated demonstration data. Thresholds are not calibrated defect probabilities or a road-safety rating.',
         fontsize=10, color='#687080')
fig.subplots_adjust(left=.055, right=.98, top=.755, bottom=.22, wspace=.13)
fig.savefig(ROOT / 'docs/images/synthetic-evidence.png', dpi=140, facecolor=fig.get_facecolor())
plt.close(fig)
