import path from 'path';
import glob from 'tiny-glob';

glob(`${path.join(__dirname, 'commands')}/**/*.ts`)
  .then(async (files) => {
    await Promise.all(files.map((path) => import(path)));
  })
  .catch((err) => {
    console.error(err);
  });

glob(`${path.join(__dirname, 'events')}/**/*.ts`)
  .then(async (files) => {
    await Promise.all(files.map((path) => import(path)));
  })
  .catch((err) => {
    console.error(err);
  });
