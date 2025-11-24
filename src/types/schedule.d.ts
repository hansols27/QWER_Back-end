export type EventType = "B" | "C" | "E"; // Birthday, Concert, Event

export interface ScheduleEvent {
  id: string;      // DB 연동용 id 추가
  start: Date;
  end: Date;
  type: EventType;
  title: string;
  allDay: boolean;
  color: string;
}
