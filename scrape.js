var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var extend = require('extend');
var async = require('async');
var app = express();

app.use(express.static(__dirname + '/public'))

var leagueURL = 'http://www.worldfootball.net/players/champions-league-2014-2015/';
var teamRankingURL = 'http://www.uefa.com/memberassociations/uefarankings/club/';

scrape();

// fetchTeamList(leagueURL);
// fetchTeamRanking(teamRankingURL);

function scrape(){
    async.series([
        fetchTeamRanking,
        fetchTeamList
    ],
    // optional callback
    function(err, results){
        // results is now equal to ['one', 'two']
        console.log("All Data Fetched");
    });
}

function fetchTeamRanking(cb){
	var teamRanking = [];

	request(teamRankingURL, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);

			$('#clubrank').first().filter(function(){
				var data = $(this);

				var tableLength = data.find('.clubLnk').length;

				for(var i = 1; i <= tableLength; i++){
					var name = data.find('.clubLnk').eq(i).text();
						teamRanking[i-1] = name;
				}

			});

			// Callback
			console.log(teamRanking);
			fs.writeFile('public/data/uefa-ranking.json', JSON.stringify(teamRanking, null, 4), function(err){
	        	console.log('UEFA Ranking file successfully written!');
                cb(null, "Team Ranking");
	        	// res.send("Team Ranking Fetched");
	    	});
			
		}
		// !error ends here
		
	});
}

function fetchTeamList(cb){
	var teamURLs = [];

	request(leagueURL, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);

			$('.portfolio').find('.box').first().filter(function(){
				var data = $(this);

				var tableLength = data.find('tr').length;
				console.log(tableLength);
				
				var n;

				// Table Iteration
				for(var i = 1; i <= tableLength; i++){
					n = i - 1;

					// var tName = data.find('tr:nth-of-type(' + i + ')').find('td:nth-of-type(3)').find('a').text();
					var tURL = "http://www.worldfootball.net" + data.find('tr:nth-of-type(' + i + ')').find('td:nth-of-type(2)').find('a').attr('href') + "2015/2/";
					teamURLs[n] = tURL;
					
				}
				// Table Iteration Ends

			});

			// Callback
			// console.log(teamURLs);

			// Async Scrape Data of Each Team
			async.each(teamURLs, fetchSquadList, function(err){
				if(!err){
					console.log("Champions Scraping Finished");
                    cb(null, "Team Squads");
					// res.send("Champions League Teams Information Fetched");
				}
			});

			
		}
		// !error ends here
		
	});
}

function fetchSquadList(url, cb){
	var teamInfo = {};
	var playerURLs = [];
	var players = [];
	var teamName;
	var fileName;

	request(url, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);

			teamName = $('.emblemwrapper').find('.head').find('h2').text();
			fileName = teamName.replace(" ","-").toLowerCase();
			teamInfo.teamName = teamName;
			teamInfo.fileName = fileName;

			$('.portfolio').find('.standard_tabelle').first().filter(function(){
				var data = $(this);

				var tableLength = data.find('tr').length;
				var currentPosition;
				var n = 0;

				// Table Iteration
				for(var i = 1; i <= tableLength; i++){
					if(data.find('tr:nth-of-type(' + i  +')').find('th').length==1){
						currentPosition = data.find('tr:nth-of-type(' + i +')').find('b').text();
						if (currentPosition == "Manager"){
							break;
						}
					}
					else{
						var playerURL = "http://www.worldfootball.net" + data.find('tr:nth-of-type(' + i +')').find('a').attr('href');
						var birth = data.find('tr:nth-of-type(' + i +')').find('td:nth-of-type(5)').text();
						var nationality = data.find('tr:nth-of-type(' + i +')').find('td:nth-of-type(4)').text();

						players[n] = {};
						players[n].url = playerURL;
						players[n].position = currentPosition;
						players[n].birth = birth;
						players[n].nationality = nationality;
						playerURLs[n] = playerURL;
						n++;
					}
				}
				// Table Iteration Ends

			});

			// Callback
			accumulatePlayers(playerURLs, players, teamInfo, cb);

		}
		// !error ends here
		
	});
}

function accumulatePlayers(_url, _players, _teamInfo, _cbLeague){
	async.map(_url, fetchPlayer, function(err, results){
			if(err){

			}else{
				for(var i=0; i<results.length; i++){
					//ACTION
					extend(_players[i], results[i]);
				}
				_teamInfo.players = _players.slice(0);
				
				console.log("LOGGED " + _teamInfo.teamName);
				writeJSON(_teamInfo, _cbLeague);
			}
		});
}

function fetchPlayer(url, cb){
	request(url, function(error, response, html){

        // First we'll check to make sure no errors occurred when making the request

        var player = {}
        var name, number;
		var clubHistory = [];

        if(!error){
            // Next, we'll utilize the cheerio library on the returned html which will essentially give us jQuery functionality

            var $ = cheerio.load(html);

            // Finally, we'll define the variables we're going to capture

			name = $('title').text().replace(/^\s/, '');

			// Club History & Shirt Number
			$('.portfolio').find('.box').first().filter(function(){
				var data = $(this);
				
				var tableLength = $('.portfolio').find('.box').first().find('tr').length;

				for(var i = 1; i <= tableLength - 1; i++){
					n = i-1;
					clubHistory[n] = {};

					if(data.find('tr:nth-of-type(' + i  +')').find('td').length==5){
						clubHistory[n].year = data.find('tr:nth-of-type(' + i  +')').find('td').first().text()
						clubHistory[n].team = data.find('tr:nth-of-type(' + i  +')').find('td:nth-of-type(3)').text();

						clubHistory[n].startYear = clubHistory[n].year.split("-")[0].trim().split("/")[1];
						clubHistory[n].endYear = clubHistory[n].year.split("-")[1].trim().split("/")[1];
					}
					else if(data.find('tr:nth-of-type(' + i  +')').find('td').length==3){
						clubHistory[n].year = data.find('tr:nth-of-type(' + i  +')').find('td:nth-of-type(2)').find('div').text().split('\t')[30]
						clubHistory[n].team = data.find('tr:nth-of-type(' + i  +')').find('td:nth-of-type(2)').find('b').text();

						clubHistory[n].startYear = clubHistory[n].year.split("-")[0].trim().split("/")[1];
						clubHistory[n].endYear = clubHistory[n].year.split("-")[1].trim().split("/")[1];

						// Shirt Number
						number = data.find('tr:nth-of-type(' + i  +')').find('td:nth-of-type(3)').find('b').text()
					}
				}

			});

			player.name = name;
			player.number = number;
			player.clubHistory = clubHistory.slice(0);
			cb(null, player);
		}

        
	});
}

function writeJSON(_teamInfo, _cbLeague){
	fs.writeFile("public/data/teams/" + _teamInfo.fileName + '.json', JSON.stringify(_teamInfo, null, 4), function(err){
        	console.log('File successfully written!');
        	_cbLeague();
    });
}

