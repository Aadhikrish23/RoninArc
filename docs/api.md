# RoninArc API Documentation

## Authentication

POST /auth/signup

Creates a new account.

POST /auth/login

Logs in a user and returns:

{
userdata,
token
}

## Library

GET /game

Returns user library.

POST /game/add

Adds a new game.

GET /game/:gameid

Returns a specific game.

PATCH /game/:gameid

Updates a game.

DELETE /game/:gameid

Deletes a game.

GET /game/filter/search

Filters games using query parameters.

## RAWG

GET /rawg/search

Searches games using the RAWG API.

Parameters:

query
page

# Dashboard

GET /dashboard/stats

Returns:

{
  totalGames,
  playing,
  completed,
  dropped,
  plan,
  featuredGame,
  continuePlaying,
  recentGames,
  reviewsWritten,
  averageRating,
  highestRatedGame
}

# Reviews

GET /review/:gameId

Returns review for a game.

PUT /review/:gameId

Creates or updates a review.

Body:

{
  rating,
  reviewText
}

DELETE /review/:gameId

Deletes a review.