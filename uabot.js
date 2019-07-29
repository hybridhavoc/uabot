// Includes
const Discord = require('discord.js');
const logger = require('winston');
const Enmap = require('enmap');
const config = require('./config.json');
const ua = require('universal-analytics');
const uabotVisitor = ua(config.trackingId, config.clientId, {strictCidFormat: false});
const uaRegex = /ua-\d{4,9}-\d{1,4}/i;

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, { colorize: true });
logger.add(new logger.transports.File({ filename: 'logs/' + Date.now().toString() + '.log' }))
logger.level = config.loggerLevel;

// uabotReport function
function uabotReport(page, category, action, label) {
    var uabotVisitor = ua(config.trackingId, config.clientId, {strictCidFormat: false});
    var params = { ec: category, ea: action, el: label};
    uabotVisitor.pageview(page.path, page.name, page.title).event(params).send();
}

// visitorReport function
function visitorReport(guildId, trackedMember, page, category, action, label) {
    myEnmap.defer.then( () => {
        if(myEnmap.has(guildId, 'trackId')) {
            logger.verbose('Guild tracking setup. Sending event.');
            var visitor = ua('' + myEnmap.get(guildId, 'trackId') + '', trackedMember.id , {strictCidFormat: false});
            var params = { ec: category, ea: action, el: label};
            visitor.pageview(page.path, page.name, page.title).event(params).send();
        }        
    })
}

// Initialize Discord client
const client = new Discord.Client();
client.on('ready', () => {
    // Runs when the bot starts and logs in successfully
    client.user.setActivity(config.prefix + 'help for info', { type: 'LISTENING' });
    logger.info('Connected');
    logger.info('Logged in as: ' + client.user.username + ' - (' + client.user.id + ')');
    logger.info('Prefix is [' + config.prefix + ']');
    //var params = { ec: "connection", ea: "login", el: "success"};
    //uabotVisitor.pageview("/").event(params).send();
    var page = { path: '/', name: 'root', title: 'uabot' };
    uabotReport(page, "connection", "login", "success");
});

// Initialize enmap
const myEnmap = new Enmap({name: "uabot"});
myEnmap.defer.then( () => {
    logger.info(myEnmap.size + ' keys loaded');
    // myEnmap.deleteAll();
});

// Watch messages
client.on('message', async message => {
    // Ignores other bots
    if(message.author.bot) return;

    // Ignores private messages
    if(!message.guild) {
        message.author.send('You can\'t talk to me here');
    }

    // Checking to see if this guild has tracking and sends message event
    //var tracking = false;
    // Message tracking
    var page = { path: '/' + message.channel.name, name: '#' + message.channel.name, title: message.channel.name };
    visitorReport(message.guild.id, message.member, page, "message", "sent", message.author.tag);

    // Command handler
    if(message.member.hasPermission("ADMINISTRATOR") && (message.content.indexOf(config.prefix) == 0 || message.content.indexOf(config.prefix.toUpperCase()) == 0)) {
        logger.verbose('Received command ' + message.content)
        // Parses the message
        var args = message.content.substring(config.prefix.length).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        logger.verbose('Command is: [' + cmd + '].  Arguments are: {' + args + '}');

        // Get into the actual commands
        switch(cmd) {
            // help
            case 'help':
                // Sends an embed with information on how to use the plugin
                var helpCommands = '**' + config.prefix + 'track**\n';
                helpCommands += 'Provide the Google Analytics tracking ID for your property.\n'
                helpCommands += 'Example: `' + config.prefix + 'track UA-XXXX-YY`\n\n'
                helpCommands += '**' + config.prefix + 'test**\n';
                helpCommands += 'Will send a test event to your Google Analytics property with the category of `test` and the action of `sent`.\n'
                var embed = new Discord.RichEmbed();
                var description = 'uabot allow you to link your Discord server to a Google Analytics account and track some information. It tracks messages sent, members added, and members removed. '
                description += 'It also tracks voice channel entry, games being played, and when users come online. It does not provide accurate information on anything beyond these metrics, because the analytics portion is not being run on the end-user\'s system.\n\n'
                description += 'In addition, the bot will provide analytics to the bot developer on Discord servers added and removed.'
                embed.setTitle('uabot Help');
                embed.setDescription(description);
                embed.setFooter('Developed by hybridhavoc');
                embed.setTimestamp(new Date());
                embed.addField('Commands',helpCommands);
                embed.addField('About the Bot','[Learn More](https://www.hybridhavoc.com/2019/02/17/uabot/)');
                message.author.send({embed});
                // tracking this
                var page = { path: '/' + message.guild.name + "/help", name: message.guild.name + '/help', title: message.guild.name + '- uabot help' };
                uabotReport(page, "help", "sent", message.author.tag);
                message.react('☑').then( () => {message.delete(5000)});
                break;

            case 'test':
                logger.verbose('Test command entered.  {guild: ' + message.guild.name + ', channel: ' + message.channel.name + '}');
                // uabot tracking
                var page = { 
                    path: '/' + message.guild.name + '/' + message.channel.name, 
                    name: '/guilds/' + '/' + message.guild.name + '/' + message.channel.name,
                    title: 'uabot test - ' + message.guild.name + ' #' + message.channel.name 
                };
                uabotReport(page, "test", "sent", message.author.tag);
                
                // Other tracking
                var page = { path: '/' + message.channel.name, name: '#' + message.channel.name, title: message.channel.name };
                visitorReport(message.guild.id, message.member, page, "test", "sent", message.author.tag);
                message.react('☑').then( () => {message.delete(5000)});
                break;

            case 'track':
                logger.verbose('Track command entered.  {guild: ' + message.guild.name + ', id: ' + message.guild.id + ', trackId: ' + args[0] + '}');    
                // Allows the user to supply the tracking ID for the guild
                var trackId = args[0].toUpperCase();
                trackId = trackId.match(uaRegex);
                logger.verbose('Checked against regular expression: [' + trackId + ']');
                
                // Storing tracking ID
                myEnmap.set(message.guild.id, trackId, 'trackId');
                logger.verbose('Stored: {' + message.guild.id + ',[trackId: ' + myEnmap.getProp(message.guild.id,'trackId') + ']}');
                message.react('☑').then( () => {message.delete(5000)});
                break;


            default:
                logger.verbose('Didn\'t understand command');
                message.react('❌');
                message.react('❓');
                message.delete(5000);
                break;
                // End of commands
        }
    }
})

//// Tracking Events

// Voice Channel updates
client.on('voiceStateUpdate', async (oldMember, newMember) => {
    // Ignores bots
    if(oldMember.user.bot) return;

    logger.verbose('Voice state changed: {member: [' + newMember.user.tag + '], voice channel: [' + newMember.voiceChannel.name.replace(' ', '-') + '], channel id: [' + newMember.voiceChannel.id + ']}');
    // Channel change
    if(newMember.voiceChannel.id) {
        var page = { path: '/' + newMember.voiceChannel.name, name: '#' + newMember.voiceChannel.name.replace(' ', '-'), title: newMember.voiceChannel.name };
        visitorReport(newMember.guild.id, newMember, page, "voice_channel", "entered", newMember.user.tag);
    }
});

// Presence updates
client.on('presenceUpdate', async (oldMember, newMember) => {
    // Ignore bots
    if(oldMember.user.bot) return;

    // Game change
    if(!oldMember.presence.game && newMember.presence.game) {
        logger.verbose('Game changed: {member: [' + newMember.user.tag + '], new game: [' + newMember.presence.game + ']}');
        var page = { path: '/games/' + newMember.presence.game, name: '#game-change', title: newMember.presence.game };
        visitorReport(newMember.guild.id, newMember, page, "game", "changed", newMember.user.tag);
    }

    // Status change
    if(oldMember.presence.status != 'online' && newMember.presence.status == 'online') {
        logger.verbose('Status changed: {member: [' + newMember.user.tag + '], old status: [' + oldMember.presence.status + '], new status: [' + newMember.presence.status + ']}');
        var page = { path: '/', name: '#member-online', title: 'Member coming online' };
        visitorReport(newMember.guild.id, newMember, page, "member", "online", newMember.user.tag);
    }
});

// Tracks when a member joins a guild
client.on('guildMemberAdd', async member => {
    // Ignores bots
    if(member.user.bot) return;
    
    logger.verbose('Member joined a guild.  {guild: ' + member.guild.name + ', member: ' + member.user.tag + '}');
    var page = { path: '/', name: '#member-add', title: 'Welcoming new member' };
    visitorReport(member.guild.id, member, page, "member", "added", member.user.tag);
});

// Tracks when a member leaves a guild
client.on('guildMemberRemove', async member => {
    // Ignores bots
    if(member.user.bot) return;

    logger.verbose('Member left a guild.  {guild: ' + member.guild.name + ', member: ' + member.user.tag + '}');
    var page = { path: '/', name: '#member-remove', title: 'Losing a member'};
    visitorReport(member.guild.id, member, page, "member", "removed", member.user.tag);
});

//// uabot Guild Tracking
// Tracks when the bot connects to a guild
client.on('guildCreate', async guild => {
    logger.verbose('Bot joining guild. [guild: ' + guild.name + ']');
    myEnmap.defer.then( () => {
        myEnmap.ensure(guild.id, {joinDate: new Date()});
    });
    var page = { path: '/' + guild.name, name: '/guilds/' + guild.name, title: 'uabot - guild added' };
    uabotReport(page, "guild", "added", guild.name);
});

// Tracks when the bot leaves a guild
client.on('guildDelete', async guild => {
    logger.verbose('Bot leaving guild. [guild: ' + guild.name + ']');
    myEnmap.defer.then( () => {
        myEnmap.delete(guild.id);
    });
    var page = { path: '/' + guild.name, name: '/guilds/' + guild.name, title: 'uabot - guild deleted' };
    uabotReport(page, "guild", "deleted", guild.name);

})

// Attempts to reconnect 30 times upon disconnection
client.on('disconnected', function() {
    for(var i = 0; i < 30;i++) {
        logger.verbose('Disconnected. Reconnect attempt ' + i);
        setTimeout(client.login(config.token), 60000).catch(function(err) {
            logger.warn(err);
        });
    }
});

// Logs in
client.login(config.token).catch(function(err) {
    logger.warn(err);
});