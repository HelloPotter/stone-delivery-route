import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const state=sqliteTable('delivery_state',{id:text('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull()});
