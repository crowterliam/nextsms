'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { LeagueConfig } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/types';
import { safeFetch } from '@/lib/fetch';

interface ConfigSection {
  title: string;
  description: string;
  fields: ConfigField[];
}

interface ConfigField {
  key: keyof LeagueConfig;
  label: string;
  description: string;
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    title: 'Match Simulation',
    description: 'Core settings that control how matches are simulated.',
    fields: [
      {
        key: 'home_bonus',
        label: 'Home Advantage Bonus',
        description: 'Bonus applied to the home team\'s chance probability (in ten-thousandths). Higher values give the home team more scoring chances.',
        type: 'number',
        min: 0,
        max: 1000,
        step: 10,
      },
      {
        key: 'num_subs',
        label: 'Substitutes on Bench',
        description: 'Number of substitute players available on the bench for each team.',
        type: 'number',
        min: 1,
        max: 12,
      },
      {
        key: 'substitutions',
        label: 'Allowed Substitutions',
        description: 'Maximum number of substitutions each team can make during a match.',
        type: 'number',
        min: 0,
        max: 12,
      },
    ],
  },
  {
    title: 'Discipline & Injury',
    description: 'Settings for yellow/red cards, suspensions, and injuries.',
    fields: [
      {
        key: 'dp_for_yellow',
        label: 'Discipline Points — Yellow Card',
        description: 'Discipline points added when a player receives a yellow card.',
        type: 'number',
        min: 0,
        max: 20,
      },
      {
        key: 'dp_for_red',
        label: 'Discipline Points — Red Card',
        description: 'Discipline points added when a player receives a red card.',
        type: 'number',
        min: 0,
        max: 30,
      },
      {
        key: 'suspension_margin',
        label: 'Suspension Threshold',
        description: 'When a player\'s total discipline points reach this value, they receive a suspension.',
        type: 'number',
        min: 1,
        max: 50,
      },
      {
        key: 'max_injury_length',
        label: 'Max Injury Duration',
        description: 'Maximum number of weeks a player can be injured from a single incident.',
        type: 'number',
        min: 1,
        max: 52,
      },
    ],
  },
  {
    title: 'Fitness & Recovery',
    description: 'How quickly players recover fitness between matches and after injuries.',
    fields: [
      {
        key: 'updtr_fitness_gain',
        label: 'Weekly Fitness Gain',
        description: 'Fitness points recovered each week between matches.',
        type: 'number',
        min: 0,
        max: 100,
      },
      {
        key: 'updtr_fitness_after_injury',
        label: 'Post-Injury Fitness',
        description: 'Fitness level restored when a player returns from injury.',
        type: 'number',
        min: 0,
        max: 100,
      },
    ],
  },
  {
    title: 'Ability Changes — Scoring',
    description: 'Ability adjustments applied when players score goals or provide assists.',
    fields: [
      {
        key: 'AB_Goal',
        label: 'Goal',
        description: 'Ability change per goal scored.',
        type: 'number',
        min: -100,
        max: 200,
      },
      {
        key: 'AB_Assist',
        label: 'Assist',
        description: 'Ability change per assist.',
        type: 'number',
        min: -100,
        max: 200,
      },
    ],
  },
  {
    title: 'Ability Changes — Match Outcome',
    description: 'Ability adjustments based on match result.',
    fields: [
      {
        key: 'AB_Victory_Random',
        label: 'Victory Bonus (Random)',
        description: 'Random ability bonus distributed to players on the winning team.',
        type: 'number',
        min: 0,
        max: 200,
      },
      {
        key: 'AB_Clean_Sheet',
        label: 'Clean Sheet',
        description: 'Ability bonus for goalkeeper (and half for defenders) when keeping a clean sheet.',
        type: 'number',
        min: -100,
        max: 200,
      },
      {
        key: 'AB_Defeat_Random',
        label: 'Defeat Penalty (Random)',
        description: 'Random ability penalty applied to players on the losing team. Use negative values.',
        type: 'number',
        min: -200,
        max: 0,
      },
      {
        key: 'AB_Concede',
        label: 'Concede Goal',
        description: 'Ability penalty for the goalkeeper per goal conceded.',
        type: 'number',
        min: -50,
        max: 50,
      },
    ],
  },
  {
    title: 'Ability Changes — In-Game Actions',
    description: 'Ability adjustments based on player actions during a match.',
    fields: [
      {
        key: 'AB_Ktk',
        label: 'Key Tackle',
        description: 'Ability change per tackle made.',
        type: 'number',
        min: -50,
        max: 100,
      },
      {
        key: 'AB_Kps',
        label: 'Key Pass',
        description: 'Ability change per key pass.',
        type: 'number',
        min: -50,
        max: 100,
      },
      {
        key: 'AB_Sht_On',
        label: 'Shot on Target',
        description: 'Ability change per shot on target.',
        type: 'number',
        min: -50,
        max: 50,
      },
      {
        key: 'AB_Sht_Off',
        label: 'Shot off Target',
        description: 'Ability change per shot off target.',
        type: 'number',
        min: -50,
        max: 50,
      },
      {
        key: 'AB_Sav',
        label: 'Save',
        description: 'Ability change per save made by the goalkeeper.',
        type: 'number',
        min: -50,
        max: 100,
      },
    ],
  },
  {
    title: 'Ability Changes — Cards',
    description: 'Ability adjustments when players receive cards.',
    fields: [
      {
        key: 'AB_Yellow',
        label: 'Yellow Card',
        description: 'Ability change per yellow card received.',
        type: 'number',
        min: -100,
        max: 50,
      },
      {
        key: 'AB_Red',
        label: 'Red Card',
        description: 'Ability change per red card received.',
        type: 'number',
        min: -100,
        max: 50,
      },
    ],
  },
];

function configToRecord(cfg: LeagueConfig): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg)) {
    result[k] = String(v);
  }
  return result;
}

function recordToConfig(record: Record<string, string>): LeagueConfig {
  const result = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof LeagueConfig>) {
    if (key in record) {
      const parsed = parseInt(record[key], 10);
      if (!isNaN(parsed)) {
        result[key] = parsed;
      }
    }
  }
  return result;
}

export default function LeagueConfigPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [configRecord, setConfigRecord] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${slug}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfigRecord(data);
      }
    } catch {}
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await safeFetch(`/api/leagues/${slug}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configRecord),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert('Failed to save');
      }
    } catch {
      alert('Failed to save');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (!confirm('Reset all settings to defaults?')) return;
    setConfigRecord(configToRecord(DEFAULT_CONFIG));
  };

  const updateField = (key: string, value: string) => {
    setConfigRecord((prev) => ({ ...prev, [key]: value }));
  };

  const config = recordToConfig(configRecord);
  const isModified = Object.entries(DEFAULT_CONFIG).some(
    ([key, defaultValue]) => {
      const current = configRecord[key];
      if (current === undefined) return false;
      return parseInt(current, 10) !== defaultValue;
    }
  );

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Link href={`/leagues/${slug}`} className="hover:text-foreground">{slug}</Link>
        <span>/</span>
        <span>Settings</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">League Settings</h1>
        <div className="flex items-center gap-2">
          {isModified && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted"
            >
              Reset to Defaults
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {CONFIG_SECTIONS.map((section) => (
          <div key={section.title} className="border border-border rounded-lg bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
            </div>
            <div className="divide-y divide-border">
              {section.fields.map((field) => (
                <div key={field.key} className="p-4 flex items-start gap-6">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium mb-0.5">
                      {field.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type={field.type}
                      value={configRecord[field.key] ?? String(config[field.key])}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      className="w-24 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground w-8">
                      {String(DEFAULT_CONFIG[field.key]) !== String(configRecord[field.key] ?? config[field.key]) && (
                        <span className="text-primary" title={`Default: ${DEFAULT_CONFIG[field.key]}`}>
                          ({DEFAULT_CONFIG[field.key]})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
