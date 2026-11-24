import { describe, expect, it } from 'vitest';
import { clockOffset, greetingName, greetingPart, groupToday, minutesOfDay, overdueText, phaseOf, toMinutes, type ClockSession } from './session-clock';

const lesson = (id: string, startsAt: string, endsAt: string, status: ClockSession['status'] = 'open') => ({ id, status, period: { startsAt, endsAt } });
const daily = (id: string, status: ClockSession['status'] = 'open') => ({ id, status, period: null });
const ids = (list: { id: string }[]) => list.map((s) => s.id);
const at = (hhmm: string) => toMinutes(hhmm);

describe('phaseOf', () => {
  const p = { startsAt: '08:30', endsAt: '09:15' };
  it('before, during and after the lesson', () => {
    expect(phaseOf(p, at('08:29'))).toBe('before');
    expect(phaseOf(p, at('08:30'))).toBe('during');
    expect(phaseOf(p, at('09:14'))).toBe('during');
    expect(phaseOf(p, at('09:15'))).toBe('after');
  });
  it('a session without lesson time is untimed', () => expect(phaseOf(null, at('12:00'))).toBe('untimed'));
});

describe('groupToday', () => {
  const day = [lesson('j3', '08:30', '09:15'), lesson('j4', '09:15', '10:00'), lesson('j1', '07:00', '07:45'), lesson('j6', '10:30', '11:15')];

  it('before the first lesson: all next, in lesson order', () => {
    const g = groupToday(day, at('06:00'));
    expect(ids(g.next)).toEqual(['j1', 'j3', 'j4', 'j6']);
    expect(g.current).toEqual([]);
    expect(g.unfilled).toEqual([]);
  });

  it('during a lesson: it is current, the earlier open ones are unfilled, the later ones next', () => {
    const g = groupToday(day, at('08:40'));
    expect(ids(g.current)).toEqual(['j3']);
    expect(ids(g.unfilled)).toEqual(['j1']);
    expect(ids(g.next)).toEqual(['j4', 'j6']);
  });

  it('after the last lesson: nothing current or next, the open ones wait to be filled', () => {
    const g = groupToday(day, at('15:00'));
    expect(g.current).toEqual([]);
    expect(g.next).toEqual([]);
    expect(ids(g.unfilled)).toEqual(['j1', 'j3', 'j4', 'j6']);
  });

  it('in the gap between two lessons nothing is current', () => {
    const g = groupToday([lesson('a', '08:30', '09:15'), lesson('b', '10:30', '11:15')], at('09:45'));
    expect(g.current).toEqual([]);
    expect(ids(g.unfilled)).toEqual(['a']);
    expect(ids(g.next)).toEqual(['b']);
  });

  it('a lesson that ends when the next begins hands over exactly on the minute', () => {
    const g = groupToday([lesson('a', '08:30', '09:15'), lesson('b', '09:15', '10:00')], at('09:15'));
    expect(ids(g.current)).toEqual(['b']);
    expect(ids(g.unfilled)).toEqual(['a']);
  });

  it('no sessions: every group is empty', () => {
    expect(groupToday([], at('09:00'))).toEqual({ current: [], unfilled: [], next: [], done: [] });
  });

  it('a session that is not open is done whatever the time, and keeps its status for the screen to word', () => {
    const g = groupToday([lesson('a', '08:30', '09:15', 'submitted'), lesson('b', '10:30', '11:15', 'missed'), lesson('c', '12:00', '12:45', 'locked')], at('06:00'));
    expect(ids(g.done)).toEqual(['a', 'b', 'c']);
    expect(g.next).toEqual([]);
  });

  it('a daily or activity session is current all day while open, after the timed ones in order', () => {
    const g = groupToday([daily('d'), lesson('a', '08:30', '09:15')], at('20:00'));
    expect(ids(g.current)).toEqual(['d']);
    expect(ids(g.unfilled)).toEqual(['a']);
    expect(ids(groupToday([daily('d')], at('03:00')).current)).toEqual(['d']);
  });

  it('does not change the list it is given', () => {
    const input = [lesson('b', '10:00', '10:45'), lesson('a', '08:00', '08:45')];
    groupToday(input, at('09:00'));
    expect(ids(input)).toEqual(['b', 'a']);
  });
});

describe('minutesOfDay: the school clock from one instant', () => {
  const instant = new Date('2027-01-25T01:30:00Z'); // 08:30 WIB, 09:30 WITA, 10:30 WIT
  it('reads the same instant in each Indonesian zone', () => {
    expect(minutesOfDay(instant, 'Asia/Jakarta')).toBe(at('08:30'));
    expect(minutesOfDay(instant, 'Asia/Makassar')).toBe(at('09:30'));
    expect(minutesOfDay(instant, 'Asia/Jayapura')).toBe(at('10:30'));
  });
  it('midnight is 0, not 24:00', () => {
    expect(minutesOfDay(new Date('2027-01-24T17:00:00Z'), 'Asia/Jakarta')).toBe(0);
    expect(minutesOfDay(new Date('2027-01-25T16:59:00Z'), 'Asia/Jakarta')).toBe(23 * 60 + 59);
  });
});

describe('greetingPart', () => {
  it('follows the hour', () => {
    expect(greetingPart(at('03:59'))).toBe('night');
    expect(greetingPart(at('04:00'))).toBe('morning');
    expect(greetingPart(at('10:59'))).toBe('morning');
    expect(greetingPart(at('11:00'))).toBe('noon');
    expect(greetingPart(at('15:00'))).toBe('afternoon');
    expect(greetingPart(at('18:00'))).toBe('night');
  });
});

describe('greetingName', () => {
  it('takes the first name and drops degrees and honorifics', () => {
    expect(greetingName('Laras Maharani, S.Pd.')).toBe('Laras');
    expect(greetingName('Dr. Hj. Sari Wulandari, M.Pd')).toBe('Sari');
    expect(greetingName('Bu Sari')).toBe('Sari');
  });
  it('softens an all-capitals name', () => {
    expect(greetingName('ADMIN E2E')).toBe('Admin');
  });
  it('never invents Bu or Pak', () => {
    expect(greetingName('Budi Santoso')).toBe('Budi');
  });
  it('falls back to what it has', () => {
    expect(greetingName('Pak')).toBe('Pak');
    expect(greetingName('')).toBe('');
  });
});

describe('clockOffset', () => {
  it('is server minus device', () => {
    expect(clockOffset('Mon, 25 Jan 2027 01:30:00 GMT', Date.parse('2027-01-25T01:25:00Z'))).toBe(5 * 60_000);
    expect(clockOffset('Mon, 25 Jan 2027 01:30:00 GMT', Date.parse('2027-01-25T01:35:00Z'))).toBe(-5 * 60_000);
  });
  it('is null when there is no usable header', () => {
    expect(clockOffset(null, 0)).toBeNull();
    expect(clockOffset('bukan tanggal', 0)).toBeNull();
  });
});

describe('overdueText', () => {
  it('says how long ago the lesson ended', () => {
    expect(overdueText('08:30', 8 * 60 + 30)).toBe('0 menit');
    expect(overdueText('08:30', 8 * 60 + 57)).toBe('27 menit');
    expect(overdueText('07:45', 9 * 60)).toBe('1 jam 15 menit');
    expect(overdueText('07:45', 8 * 60 + 45)).toBe('1 jam');
  });
  it('is null while the lesson is not over, or for a time that is not HH:MM', () => {
    expect(overdueText('08:30', 8 * 60 + 29)).toBeNull();
    expect(overdueText('', 600)).toBeNull();
  });
});
