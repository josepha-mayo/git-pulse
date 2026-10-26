import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeFeedPosts,parseFeedCursor} from '../apps/web/src/lib/feed-state.mjs';
test('new posts precede existing ones without duplicates',()=>assert.deepEqual(mergeFeedPosts([{id:'b'},{id:'a'}],[{id:'a'},{id:'c'}]),[{id:'b'},{id:'a'},{id:'c'}]));
test('incoming edits win and input arrays stay unchanged',()=>{const old=[{id:'a',content:'old'}];assert.deepEqual(mergeFeedPosts([{id:'a',content:'new'}],old),[{id:'a',content:'new'}]);assert.equal(old[0].content,'old');});
test('feed memory remains bounded',()=>assert.equal(mergeFeedPosts(Array.from({length:140},(_,id)=>({id:String(id)})),[]).length,100));
test('invalid or future cursors are rejected',()=>{const now=new Date('2026-10-26T12:00:00Z');assert.equal(parseFeedCursor('nope',now),null);assert.equal(parseFeedCursor('2027-01-01',now),null);});
test('default cursor matches polling window',()=>assert.equal(parseFeedCursor(null,new Date('2026-10-26T12:00:00Z')).toISOString(),'2026-10-26T11:59:40.000Z'));
