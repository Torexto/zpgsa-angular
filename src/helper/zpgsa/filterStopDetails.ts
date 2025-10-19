import {DateTime} from 'luxon';
import type {StopDetailsBus} from './types';

interface Date {
  day: number;
  month: number;
}

const daysFreeFromSchool: Date[] = [
  {day: 26, month: 12}, {day: 27, month: 12}, {day: 30, month: 12},
  {day: 31, month: 12}, {day: 2, month: 1}, {day: 3, month: 1}, {day: 3, month: 2},
  {day: 4, month: 2}, {day: 5, month: 2}, {day: 6, month: 2}, {day: 7, month: 2},
  {day: 10, month: 2}, {day: 11, month: 2}, {day: 12, month: 2}, {day: 13, month: 2},
  {day: 14, month: 2}, {day: 22, month: 4},
  {day: 30, month: 6}, {day: 1, month: 7}, {day: 2, month: 7}, {day: 3, month: 7}, {day: 4, month: 7},
  {day: 7, month: 7}, {day: 8, month: 7}, {day: 9, month: 7}, {day: 10, month: 7}, {day: 11, month: 7},
  {day: 14, month: 7}, {day: 15, month: 7}, {day: 16, month: 7}, {day: 17, month: 7}, {day: 18, month: 7},
  {day: 21, month: 7}, {day: 22, month: 7}, {day: 23, month: 7}, {day: 24, month: 7}, {day: 25, month: 7},
  {day: 28, month: 7}, {day: 29, month: 7}, {day: 30, month: 7}, {day: 31, month: 7}, {day: 1, month: 8},
  {day: 4, month: 8}, {day: 5, month: 8}, {day: 6, month: 8}, {day: 7, month: 8}, {day: 8, month: 8},
  {day: 11, month: 8}, {day: 12, month: 8}, {day: 13, month: 8}, {day: 14, month: 8},
  {day: 18, month: 8}, {day: 19, month: 8}, {day: 20, month: 8}, {day: 21, month: 8}, {day: 22, month: 8},
  {day: 25, month: 8}, {day: 26, month: 8}, {day: 27, month: 8}, {day: 28, month: 8}, {day: 29, month: 8},
];

const holidays: Date[] = [
  {day: 6, month: 1}, {day: 19, month: 6}, {day: 1, month: 11}, {day: 1, month: 1}, {day: 6, month: 1}, {
    day: 23,
    month: 12
  },
  {day: 24, month: 12}, {day: 25, month: 12}, {day: 17, month: 4}, {day: 18, month: 4}, {day: 19, month: 4}, {
    day: 20,
    month: 4
  },
  {day: 21, month: 4}, {day: 1, month: 5}, {day: 3, month: 5}, {day: 15, month: 8}
];

const filterBuses = (date: DateTime, buses: StopDetailsBus[]): StopDetailsBus[] => {
  const now = {day: date.day, month: date.month};
  const isHoliday = holidays.some(d => d.day === now.day && d.month === now.month);

  return buses.filter(bus => {
    if (isHoliday) return bus.operating_days === 'sunday' || bus.operating_days === 'sun';

    switch (date.weekday) {
      case 7:
        return bus.operating_days === 'sunday' || bus.operating_days === 'sun';
      case 6:
        return bus.operating_days === 'saturday' || bus.operating_days === "sat";
      default: {
        const isSchoolDay = !daysFreeFromSchool.some(d => d.day === now.day && d.month === now.month);
        return bus.operating_days === 'mon_fri' &&
          (bus.school_restriction === 'free_day_only' ? !isSchoolDay : bus.school_restriction === 'school_only' ? isSchoolDay : true);
      }
    }
  });
};

const parseBusTime = (busTime: string, now: DateTime): DateTime | null => {
  const parsedTime = DateTime.fromFormat(busTime, 'HH:mm');
  return parsedTime.isValid ? parsedTime.set({year: now.year, month: now.month, day: now.day}) : null;
};

export default function filterStopDetails(buses: StopDetailsBus[]): StopDetailsBus[] {
  const nowDate = DateTime.now();

  let filteredBuses = filterBuses(nowDate, buses);
  filteredBuses = filteredBuses.filter(bus => {
    const busTime = parseBusTime(bus.time, nowDate);
    return busTime ? busTime >= nowDate : false;
  }).sort((a, b) => DateTime.fromFormat(a.time, 'HH:mm').toMillis() - DateTime.fromFormat(b.time, 'HH:mm').toMillis());

  if (filteredBuses.length < 15) {
    const extended = (filterBuses(nowDate.plus({days: 1}), buses)).sort((a, b) => {
      const timeA = DateTime.fromFormat(a.time.trim(), 'HH:mm');
      const timeB = DateTime.fromFormat(b.time.trim(), 'HH:mm');
      return timeA.toMillis() - timeB.toMillis();
    });
    filteredBuses = [...filteredBuses, ...extended];
  }

  return filteredBuses.slice(0, 15);
};
