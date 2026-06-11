import assert from 'node:assert/strict';
import {
  detectMovieboxLanguage,
  pickBestMovieboxMatch,
  pickMovieboxVariants,
  titleMatchScore,
} from './moviebox-match.mjs';

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

// --- language detection ---
assert.equal(detectMovieboxLanguage({ title: 'Inception [Hindi]' }), 'Hindi');
assert.equal(detectMovieboxLanguage({ title: 'Inception', postTitle: 'Inception[CAM]_1080P' }), 'Original');
assert.equal(detectMovieboxLanguage({ title: 'Inception' }), 'Original');

// --- multi-language variants: Original first, dubs grouped, look-alikes excluded ---
const inceptionItems = [
  { title: 'Inception [Tamil]', releaseDate: '2010-07-16', duration: 8880, imdbRatingValue: '8.8', hasResource: true, subjectType: 1, subjectId: 'T', detailPath: 't' },
  { title: 'Inception [Hindi]', releaseDate: '2010-09-01', duration: 8880, imdbRatingValue: '8.8', hasResource: true, subjectType: 1, subjectId: 'H', detailPath: 'h' },
  { title: 'Inception', postTitle: 'Inception[CAM]_1080P', releaseDate: '2010-07-16', duration: 8880, imdbRatingValue: '8.8', hasResource: true, subjectType: 1, subjectId: 'O', detailPath: 'o' },
  { title: 'Inception: The Cobol Job', releaseDate: '2010-12-07', duration: 3600, imdbRatingValue: '7.5', hasResource: true, subjectType: 1, subjectId: 'C', detailPath: 'c' },
];
const variants = pickMovieboxVariants(tmdbInception, inceptionItems);
assert.ok(variants.length >= 3, 'should find Original + Hindi + Tamil');
assert.equal(variants[0].language, 'Original');
assert.equal(variants[0].isOriginal, true);
assert.deepEqual(variants.map((v) => v.language), ['Original', 'Hindi', 'Tamil']);
assert.ok(!variants.some((v) => v.item.subjectId === 'C'), 'must not group "Inception: The Cobol Job"');

// --- strictness: exact-title match scoring < 0.62 (missing year, bad duration +
// rating) is rescued; a wrong-year remake with the same title is not ---
const lowSignal = [
  { title: 'Inception', releaseDate: '', duration: 60, imdbRatingValue: '3.0', hasResource: true, subjectType: 1, subjectId: 'L', detailPath: 'l' },
];
const lowMatch = pickBestMovieboxMatch(tmdbInception, lowSignal);
assert.ok(lowMatch, 'exact title should not be excluded by weak duration/rating');
assert.ok(lowMatch.score < 0.62, 'this case must be below the normal bar to prove the rescue');

const remake = [
  { title: 'Inception', releaseDate: '1995-01-01', duration: 60, imdbRatingValue: '3.0', hasResource: true, subjectType: 1, subjectId: 'R', detailPath: 'r' },
];
assert.equal(pickBestMovieboxMatch(tmdbInception, remake), null, 'contradicting-year remake must stay excluded');

console.log('moviebox-match tests OK');
