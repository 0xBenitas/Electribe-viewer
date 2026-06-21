import { describe, it, expect } from 'vitest';
import {
  buildProfileDraft,
  slugify,
  answersComplete,
  profileFilename,
  DEFAULT_ANSWERS,
  type SetupAnswers,
} from './deviceSetup.ts';

const answers = (over: Partial<SetupAnswers> = {}): SetupAnswers => ({
  ...DEFAULT_ANSWERS,
  manufacturer: 'Elektron',
  model: 'Model:Samples',
  portNameMatch: 'Model:Samples',
  ...over,
});

describe('slugify', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(slugify('Korg Électribe 2!')).toBe('korg-electribe-2');
    expect(slugify('Model:Samples')).toBe('model-samples');
  });
});

describe('answersComplete', () => {
  it('needs manufacturer, model and a positive track count', () => {
    expect(answersComplete(answers())).toBe(true);
    expect(answersComplete(answers({ model: '  ' }))).toBe(false);
    expect(answersComplete(answers({ trackCount: 0 }))).toBe(false);
  });
});

describe('buildProfileDraft', () => {
  it('produces a schema-v1 draft profile from answers', () => {
    const p = buildProfileDraft(
      answers({
        channelModel: 'multi',
        trackCount: 6,
        trackLabel: 'tracks',
        clockMaster: true,
        clockSlave: true,
        transport: true,
        songPosition: true,
        stereoOut: true,
        sysex: true,
      }),
    );
    expect(p).toMatchObject({
      schemaVersion: 1,
      id: 'elektron-model-samples',
      status: 'draft',
      identity: {
        manufacturer: 'Elektron',
        model: 'Model:Samples',
        webMidiPortNames: ['Model:Samples'],
      },
      midi: { channelModel: 'multi', sysex: true, ccParams: [] },
      clock: {
        canBeMaster: true,
        canBeSlave: true,
        transport: ['start', 'stop', 'continue'],
        songPosition: true,
      },
      tracks: { count: 6, label: 'tracks' },
      audio: { outputs: [{ name: 'Main', channels: 'stereo' }] },
    });
    expect(profileFilename(p)).toBe('elektron-model-samples.json');
  });

  it('omits the port matcher when blank and empties transport when off', () => {
    const p = buildProfileDraft(
      answers({ portNameMatch: '   ', transport: false, stereoOut: false }),
    );
    expect(p.identity.webMidiPortNames).toEqual([]);
    expect(p.clock.transport).toEqual([]);
    expect(p.audio.outputs[0]!.channels).toBe('mono');
  });
});
