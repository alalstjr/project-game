import { getDb } from '../database.js';
import { TICKET_REGEN_MINUTES, MAX_TICKETS } from '../constants.js';

export function regenerateTickets(userId: number): { tickets: number; nextTicketInSeconds: number } {
  const db = getDb();
  const user = db.prepare('SELECT pull_tickets, last_ticket_at FROM users WHERE id = ?').get(userId) as {
    pull_tickets: number;
    last_ticket_at: string;
  };

  const lastTime = new Date(user.last_ticket_at + 'Z').getTime();
  const now = Date.now();
  const elapsedMs = now - lastTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const newTickets = Math.floor(elapsedMinutes / TICKET_REGEN_MINUTES);

  let tickets = user.pull_tickets;
  if (newTickets > 0) {
    tickets = Math.min(tickets + newTickets, MAX_TICKETS);
    const consumedMs = newTickets * TICKET_REGEN_MINUTES * 60 * 1000;
    const newLastTime = new Date(lastTime + consumedMs).toISOString().replace('Z', '').replace('T', ' ').split('.')[0];
    db.prepare('UPDATE users SET pull_tickets = ?, last_ticket_at = ? WHERE id = ?').run(tickets, newLastTime, userId);
  }

  const timeSinceLast = elapsedMs - newTickets * TICKET_REGEN_MINUTES * 60 * 1000;
  const nextTicketInSeconds = Math.max(0, Math.ceil((TICKET_REGEN_MINUTES * 60 * 1000 - timeSinceLast) / 1000));

  return { tickets, nextTicketInSeconds };
}

export function deductTicket(userId: number): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE users SET pull_tickets = pull_tickets - 1 WHERE id = ? AND pull_tickets > 0').run(userId);
  return result.changes > 0;
}

export function addTickets(userId: number, amount: number) {
  const db = getDb();
  db.prepare('UPDATE users SET pull_tickets = MIN(pull_tickets + ?, ?) WHERE id = ?').run(amount, MAX_TICKETS, userId);
}

export function getTickets(userId: number): number {
  const db = getDb();
  const row = db.prepare('SELECT pull_tickets FROM users WHERE id = ?').get(userId) as { pull_tickets: number };
  return row.pull_tickets;
}
