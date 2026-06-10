import assert from 'node:assert/strict';
import { pickBestMovieboxMatch, titleMatchScore } from './moviebox-match.mjs';

const tmdbInception = {
  type: 'movie',
  title: 'Inception',
  year: 2010,
  runtime: 148,
  vote_average: 8.4,
};

const badHits = [
  { title: 'In the Grey', postTitle: 'In the Grey[CAM]_1080P', releaseDate: '2026-05-15', duration: 5880, imdbRatingValue: '7.3', hasResource: true, subjectType: 1 },
  { title: 'The Shawshank Redemption', postTitle: 'The Shawshank Redemption', releaseDate: '1994-10-14', duration: 8520, imdbRatingValue: '9.3', hasResource: true, subjectType: 1 },
];

assert.equal(pickBestMovieboxMatch(tmdbInception, badHits), null);

const goodHit = [
  {
    title: "O' Romeo",
    postTitle: "O' Romeo[CAM]_1080P",
    releaseDate: '2026-02-13',
    duration: 6412,
    imdbRatingValue: '6.8',
    hasResource: true,
    subjectType: 1,
    subjectId: '1',
    detailPath: 'x',
  },
];

const tmdbRomeo = { type: 'movie', title: "O' Romeo", year: 2026, runtime: 107, vote_average: 6.8 };
const match = pickBestMovieboxMatch(tmdbRomeo, goodHit);
assert.ok(match);
assert.ok(match.score >= 0.62);
assert.ok(titleMatchScore("O' Romeo", "O' Romeo", "O' Romeo[CAM]_1080P") >= 0.9);

const tmdbFrom = { type: 'tv', title: 'From', year: 2022, runtime: 60, vote_average: 7.8 };
const fromHits = [
  { title: 'From S1-S4', postTitle: 'From', releaseDate: '2022-04-10', duration: 0, imdbRatingValue: '7.8', hasResource: true, subjectType: 2 },
  { title: 'Strangers from Hell', postTitle: 'x', releaseDate: '2019-01-01', duration: 3600, hasResource: true, subjectType: 2 },
];
const fromMatch = pickBestMovieboxMatch(tmdbFrom, fromHits);
assert.ok(fromMatch);
assert.equal(fromMatch.item.title, 'From S1-S4');

console.log('moviebox-match tests OK');
