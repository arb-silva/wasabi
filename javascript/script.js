/*
Main script for Wasabi web app (for visualisation and analysis of multiple sequence alignment data). 
Written by Andres Veidenberg //andres.veidenberg{at}helsinki.fi//, University of Helsinki [2011]
*/

var currentversion = 131202; //local version (timestamp) of Wasabi
var sequences = {}; //seq. data {name : [s,e,q]}
var treesvg = {}; //phylogenetic nodetree
var leafnodes = {}; //all leafnodes+visible ancestral leafnodes
var letters = '-_.:?!*=AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'.split('');
var alphabet = {protein:['A','R','N','D','C','Q','E','G','H','I','L','K','M','F','P','S','T','W','Y','V','B','Z','X'],
dna:['A','T','G','C','N','X'], rna:['A','G','C','U','N','X'], gaps: ['-','_','.',':','?','!','*','='], codons:{TTT:'F', TTC:'F', TTA:'L', TTG:'L', CTT:'L', CTC:'L', CTA:'L', CTG:'L', ATT:'I', ATC:'I', ATA:'I', ATG:'M', GTT:'V', GTC:'V', GTA:'V', GTG:'V', TCT:'S', TCC:'S', TCA:'S', TCG:'S', CCT:'P',CCC:'P',CCA:'P',CCG:'P', ACT:'T',ACC:'T',ACA:'T',ACG:'T', GCT:'A', GCC:'A',GCA:'A', GCG:'A', TAT:'Y', TAC:'Y', TAA:'*',TAG:'*', CAT:'H',CAC:'H', CAA:'Q',CAG:'Q', AAT:'N',AAC:'N', AAA:'K',AAG:'K', GAT:'D', GAC:'D', GAA:'E',GAG:'E', TGT:'C',TGC:'C', TGA:'*', TGG:'W', CGT:'R',CGC:'R',CGA:'R',CGG:'R', AGT:'S',AGC:'S', AGA:'R', AGG:'R', GGT:'G', GGC:'G', GGA:'G', GGG:'G'}};
var colors = {};
var symbols = {};
var canvassymbols = {'_':'-','.':'+',':':'+','!':'?','=':'*'}; //canvas masks
var canvaslabels = {'-':'gap','_':'gap','.':'ins.',':':'ins.','?':'unkn.','!':'unkn.','*':'stop','=':'stop'};
var canvaslist = []; //list of rendered seq. tiles
var colflags = []; //(selection-)flagged columns
var rowflags = [];
var selections = [];
var maskedcols = []; //array of columns masked via sequence menu
var filescontent = {}; //temporary file data for import/export
var filetypes = {};
var exportedseq = '';
var exportedtree = '';
var dom = {}; //global references to DOM elemets

//custom settings to map data from server to local datamodel
var libraryopt = {
	key: function(item){ return item.parentid+item.id; },
	copy: ['id','parentid','parameters','aligner','infile','logfile','source'],
	name: { create: function(opt){ //requires modified ko.mapping to work on our nested data
		var mapped = ko.observable(opt.data);
		mapped.subscribe(function(newname){
			if(librarymodel.openid()==opt.parent.id) exportmodel.savename(newname);
			communicate('writemeta',{id:opt.parent.id, key:'name', value:newname}); });
		return mapped;
	}}
};

var serverdata = {import: {}, library: ko.mapping.fromJS([],libraryopt)};

//extenders to KO viewmodel items
ko.extenders.format = function(obsitem, formattype){ //format an observable value in-place
    var formatted = ko.computed({
        read: obsitem,
        write: function(incoming){
        	var current = obsitem(), newval = incoming;
            if(formattype=='trim' && typeof(newval)=='string'){ newval = newval.trim(); }
 			if(current!=newval) obsitem(newval);
        }
    });
 	formatted(obsitem());
 	return formatted;
};

ko.extenders.enable = function(obsitem, bool){ //add filter to enable/disable an observable
    var filtered = ko.computed({
        read: obsitem,
        write: function(incoming){
        	if(bool) obsitem(incoming);
        }
    });
 	filtered(obsitem());
 	return filtered;
};

/* KnockOut data models to keep the state of the system */
//datamodel to represent analyses library (including running jobs)
var koLibrary = function(){
	var self = this;
	
	self.getitem = function(id){ //get library item by its ID
		var item = ''; if(!id) return '';
		$.each(serverdata.library(),function(i,obj){
			if(id==obj.id){ item = obj; return false; }
		});
		return item;
	}
	
	self.dirpath = ko.observableArray(['']) //current library treepath
	self.cwd = ko.computed(function(){ var arr = self.dirpath(); return arr[arr.length-1]; });
	self.updir = function(){ if(self.dirpath().length>1) self.dirpath.pop(); };
	self.openid = ko.observable(''); //opened job ID
	self.openname = ko.computed({
		read: function(){ return self.getitem(self.openid()).name||''; },
		write: function(newval){ var itm = self.getitem(self.openid()); if(itm) itm.name(newval); }
	});
	self.openpath = ko.computed(function(){
		var id = self.openid(), arr = [];
		while(id){
			id = self.getitem(id).parentid;
			arr.push(id);
		}
		if(!arr.length) arr = [''];
		return arr;
	});
	self.openparent = ko.computed(function(){ return self.openpath()[0]; });
	self.importurl = '';
	self.addanim = function(div){ $(div).hide().fadeIn(800); };
	
	self.removetimer = 0;
	self.removeitem = function(item, event){ //delete item/kill job
		var btn = event.target;
		var running = item.status && isNaN(item.status()) ? true : false;
		var action = running? 'terminate' : 'rmdir';
		var startlabel = running? 'Kill' : 'Delete';
		if(btn.innerHTML == startlabel){
			btn.innerHTML = 'Confirm';
			self.removetimer = setTimeout(function(){ btn.innerHTML = startlabel; },4000);
		}else{
			clearTimeout(self.removetimer);
			communicate(action,{id:item.id},{btn:btn});
			if(action=='rmdir' && item.id==self.openid()){ self.openid(''); model.unsaved(true); }
		}
		return false; //onclick reponse
	};
	
	self.importitem = function(item, event){ //mark job as imported to library
		if(!item.outfile() || $('#job_'+item.id+' .importtick>input')[0].checked){ communicate('writemeta',{id:item.id,key:'imported'}); }
		else{ //also import to wasabi browser
			getfile({id:item.id, file:item.outfile(), btn:event.target||false});
		}
	}
	
	self.toggleitem = function(item, event){ //expand/contract library item div
		var btn = event.target;
		var itemdiv = $(btn).closest('div.itemdiv');
		if(btn.innerHTML == '\u25BC More info'){ //expand itemdiv
			itemdiv.css('height',itemdiv.children().first().height()+12+'px');
			setTimeout(function(){btn.innerHTML = '\u25B2 Less info';},400);
		}
		else{ //contract
			itemdiv.css('height','');
			setTimeout(function(){btn.innerHTML = '\u25BC More info';},400);
		}
		return false;
	};
	
	self.sharelink = function(item,file,url){
		var urlstr = '';
		if(item && item.id && (file||item.outfile)) urlstr = 'share='+item.id+'&file='+(file||item.outfile())+(item.name?'&name='+item.name():'');
		else urlstr = 'url='+url;
		return encodeURI('http://'+window.location.host+'?'+urlstr);
	}
	
	self.shareicon = function(item,file,title,url){
		if(settingsmodel.sharelinks() && (item||url)){
			return '<span class="svgicon share" title="'+(title||'Share this file')+'" onclick="dialog(\'share\',{url:\''+self.sharelink(item,file,url)+'\'})">'+svgicon('link')+'</span>';
		} else return '';
	}
	
	self.showfile = function(item, event, file){ //show logfile/library folder content from server
		var btn = $(event.target);
		var logdiv = btn.closest('div.itemdiv').next('div.logdiv');
		var rotatearr = btn.prev('span.rotateable');
		if(!logdiv.length){ //content div not yet created
			logdiv = $('<div class="insidediv logdiv">');
			btn.closest('div.itemdiv').after(logdiv);
		}
		
		if(logdiv.css('display')=='none'){ //show content div
			if(rotatearr.length) rotatearr.addClass('rotateddown');
			logdiv.slideDown();
			if($('span',logdiv).length) return false; //use cache
		}
		else{ //hide content div
			if(rotatearr.length) rotatearr.removeClass('rotateddown');
			logdiv.slideUp();
			return false;
		}

		if(file){ //show logfile content
			getfile({id:item.id, file:file, btn:logdiv, skipimport:true});
    	}
    	else{ //show library folder content
    		communicate('getdir',{dir:item.id},{success: function(data){
    			var files = JSON.parse(data);
    			var str = '';
    			var outfile = item.outfile?item.outfile():''; //mark the results file in filelist
    			$.each(files,function(fname,fsize){ //build filelist html
    				if(isNaN(fsize)) return true; //skip folders
    				str += '<div class="row">';
    				if(~outfile.indexOf(fname)){
    					str += '<span title="Main data file" style="color:darkred;cursor:default">'+fname+'</span>';
    				}
    				else str += fname;
    				str += '<span class="note">'+numbertosize(fsize,'byte')+'</span>'+self.shareicon(item,fname);
    				if(~fname.indexOf('.xml')){
    					str += '<a class="button" style="right:60px" title="Load to browser" '+
    				  	'onclick="communicate(\'writemeta\',{id:\''+item.id+'\',key:\'outfile\',value:\''+
    				  	fname+'\'});getfile({id:\''+item.id+'\',file:\''+fname+'\',btn:this})">Open</a>';
    				}
    				str += '<a class="button" onclick="dialog(\'export\',{exporturl:\''+settingsmodel.userid+
    				'?type=text&getlibrary='+item.id+'&file='+fname+'\'})" title="View file content">View</a></div>';
    			});
    			logdiv.html(str);
    		}});
    	}
    	return false;
    }//showfile()
	
	self.sortopt = [{t:'Name',v:'name'},{t:'Created',v:'starttime'},{t:'Opened',v:'imported'},{t:'Saved',v:'savetime'}];
	self.sortkey = ko.observable('starttime');
	self.sortasc = ko.observable(true);
	self.libraryview = ko.computed(function(){ //data items in library window
		var viewitems = [];
		var key = self.sortkey(), asc = self.sortasc(), curdir = self.cwd();
		var itemsarray = serverdata.library();
		var childcount = {};
		$.each(itemsarray, function(i, item){  if(item.parentid && !isNaN(item.status?item.status():0)) childcount[item.parentid] = (childcount[item.parentid]||0)+1; });
		$.each(itemsarray, function(i, item){ //add data to library items
			try{ var inlibrary = Boolean(item.parentid==curdir && (!item.status||parseInt(item.status())||item.imported())); }catch(e){ var inlibrary = false; }
			if(!inlibrary) return true; //skip items not in current library page
    		item.children = childcount[item.id] || 0;
    		viewitems.push(item);
		});
		viewitems.sort(function(a,b){ //sort the items
			return a[key]&&b[key]? (asc?a[key]()>b[key]():a[key]()<b[key]())? 1:-1 :0;
		});
		return viewitems;
	}).extend({throttle:200});
	
	self.runningjobs = ko.observable(0);
	self.jobtimer = '';
	self.runningjobs.subscribe(function(running){
		if(running){ //set up a status check loop
			if(!self.jobtimer) self.jobtimer = setInterval(function(){ communicate('getlibrary'); },5000);
		}
		else{ clearInterval(self.jobtimer); self.jobtimer = ''; }
	});
	self.readyjobs = ko.observable(0);
	self.autoimport = '';
	self.parselog = function(item){
		var logline = item.log(), status = item.status(), params = item.parameters;
		var progr = logline.match(/#\((\d+)\/(\d+)\)/), html = logline;
		if(!progr && ~logline.indexOf('Nothing yet')){ html = 'Waiting for feedback...'; }
		else if(~logline.indexOf('Cputime limit')){
			var timelimit = settingsmodel.jobtimelimit? settingsmodel.jobtimelimit+'-hour':'time';
			html = 'Job ran over '+timelimit+' limit. Reduce the input dataset.';
		}
		else if(status=='-15'){ html = 'Job terminated by the user'; }
		else if(progr){
			var iter = logline.match(/iteration \d/), iters = params.match(/iterate=\d/);
			if(iter&&iters){ var i = iter[0]+' of '+iters[0]+'. ', d = parseInt(iters[0]); }else{ var i='', d=1; }
			var t = i+'Aligning sequence '+progr[1]+' of '+progr[2];
			var perc = Math.round(((progr[1]-1)/progr[2])*(100/d));
			var mouseover = 'onmouseover="tooltip(false,\''+t+'\',{arrow:\'bottom\',target:this,style:\'white\',autohide:2000})"';
			html = 'Aligning: <span class="progressline" style="width:250px" '+mouseover+'>'+
		   	  '<span class="bar" style="width:'+perc+'%"></span></span>';
		}
		return html;
	};
	self.jobsview = ko.computed(function(){ //data items in server jobs window
		var viewitems = [], running = 0, ready = 0;
		var itemsarray = serverdata.library();
		var sortk = 'starttime';
		itemsarray.sort(function(a,b){ return a[sortk]&&b[sortk]? a[sortk]()>b[sortk]()? 1:-1 : 0; });
		$.each(itemsarray, function(i, item){ //pull job items from library data
			try{ if(!item.status() || item.imported()) return true; }catch(e){ return true; }//skip library items
			if(!item.st) item.st = ko.observable(0);
			var status = item.status(); //status: init|queued|running|0|-1
			if(isNaN(status)){ item.st(0); running++; } //a running job
			else if(status=='0' && item.outfile()){ //job successfully finished
				item.st(2); ready++;
				if(self.autoimport && item.id==self.autoimport) getfile({id:item.id,btn:$('#job_'+item.id+' a.itembtn'),file:item.outfile()});
			}
			else{ //job failed
				item.st(1); ready++;
				if(~item.parameters.indexOf('-updated')) model.treealtered(true); //realign failed => revert tree status
			}
			viewitems.push(item);
		});
		self.runningjobs(running);
		self.readyjobs(ready);
		return viewitems;	
	}).extend({throttle:200});
}
var librarymodel = new koLibrary();

//ensembl import settings
var koEnsembl = function(){
	var self = this;
	self.idformats = [{name:'Gene',url:'homology',example:'ENSG00000198125'},{name:'GeneTree',url:'genetree',example:'ENSGT00390000003602'}];
	self.idformat = ko.observable(self.idformats[1]);
	self.ensid = ko.observable('').extend({format:'trim'});
	self.seqtype = ko.observable('protein');
	self.homtype = ko.observable('all');
	self.aligned = ko.observable(true);
	self.target = ko.observable('');
	self.idspecies = ko.observable('');
	self.idname = ko.observable('');
	self.epolist = [{type:'EPO',set:[{name:'primates',ref:'homo_sapiens'},{name:'mammals',ref:'homo_sapiens'},{name:'birds',ref:'gallus_gallus'},{name:'fish',ref:'danio_rerio'}]}, {type:'EPO (low coverage)',set:[{name:'mammals',ref:'homo_sapiens'},{name:'fish',ref:'danio_rerio'}]}];
	self.epotype = ko.observable(self.epolist[0]);
	self.eposet = ko.observable({name:''});
	self.dbopt = ['72','71','70','69','68','67','66','65'];
	self.dbver = '72';
	self.maskopt = ['unmasked','soft-masked','hard-masked'];
	self.mask = self.maskopt[1];
	self.outname = 'epo_slice';
	self.epojob = ko.observable('');
	self.epojobperc = ko.computed(function(){
		var epoid = self.epojob();
		if(!epoid) return '0%';
		var libitems = serverdata.library(), item = '';
		$.each(libitems,function(i,obj){
			if(epoid==obj.id){ item = obj; return false; }
		});
		if(!item) return '0%';
		var logline = item.log();
		if(~logline.indexOf('%:')){ //show & update epo fetching progress
			var progress = logline.split(':');
			if(progress[0]=='100%'){ //epo data ready. import it from library.
				var outfile = self.outname+'_1.xml';
				self.epojob('');
				communicate('writemeta',{id:item.id,key:'outfile',value:outfile});
				getfile({id:item.id, file:outfile, btn:document.getElementById('ensbtn')});
				if(parseInt(progress[1])>1){
					setTimeout(function(){
						dialog('notice','Your selected region crossed an EPO alignment block boundary and<br>was split to separate files.'+
						'<br><br>You can selectively import files from the directory filelist in <a onclick="dialog(\'library\')">analysis library</a>.');
					},5000);
				}
			}else{ setTimeout(function(){ communicate('getlibrary'); },1000); }
			return progress[0];
		}else{ //show error & cancel updating
			if(~logline.indexOf('yet.')){ setTimeout(function(){ communicate('getlibrary'); },1000); return '0%'; }
			self.epojob('');
			var ensbtn = $('#ensbtn'), enserror = $('#enserror');
			if(ensbtn.length){
				ensbtn.text('Error');
				enserror.html('Process failed: <a class="button square" onclick="dialog(\'export\',{exporturl:\''+settingsmodel.userid+
    				'?type=text&getlibrary='+item.id+'&file='+item.logfile+'\'})">View errors</a>');
    			enserror.fadeIn();
				setTimeout(function(){ ensbtn.click(ensemblimport); ensbtn.text('Import'); enserror.fadeOut(); },5000);
			}
			return '0%';
		}
	}).extend({throttle:100});
}
var ensemblmodel = new koEnsembl();

//datamodel for Wasabi settings
var koSettings = function(){
	var self = this;
	self.toggle = function(obsvalue){ obsvalue(!obsvalue()); }
	self.btntxt = function(obsvalue){ return obsvalue()?'ON':'OFF'; }
	self.preflist = {tooltipclass:'', undolength:'', autosaveint:'autosave', onlaunch:'', zoomlevel:'keepzoom', userid:'keepuser', colorscheme:'', boxborder:'', font:'', windowanim:'', allanim:'', hidebar:'', minlib:'', skipversion:'', checkupdates:'local', bundlestart:'local'};
	self.saveprefs = function(){ //store preferences to harddisk
		$.each(self.preflist,function(pref,checkpref){
			var t = typeof(self[pref]), ct = typeof(self[checkpref]);
			var checkval = checkpref&&self[checkpref]&&(ct!='function'||self[checkpref]());
			if(!checkpref || checkval){ //check for enable/disable setting
				if(t!='undefined') localStorage[pref] = JSON.stringify(t=='function'? self[pref]():self[pref]);
			}
			else if(checkpref){ localStorage.removeItem(pref); }
		});
	};
	self.loadprefs = function(){
		$.each(self.preflist,function(pref,checkpref){
			if(localStorage[pref]){
				if(checkpref && localStorage[checkpref] && !JSON.parse(localStorage[checkpref])) return true; //skip disabled settings
				try{
					var prefval = JSON.parse(localStorage[pref]);
					if(typeof(self[pref])=='function') self[pref](prefval); else self[pref] = prefval;
				} catch(e){
					console.log(localStorage[pref]+" => "+e);
					localStorage.removeItem(pref);
				}
			}
		});
	};
	//settings from server
	self.userid = ''; //current userID
	self.jobtimelimit = 0; //server-side limits
	self.datalimit = 0;
	self.userexpire = 0;
	self.local = false; //Wasabi istalled as local server
	self.syncsetting = function(newval,setting,obs,params){ if(obs.sync) communicate('settings', {setting:setting, value:newval}, params||{}); }; //server settings syncing
	self.bundlestart = ko.observable(true); //feedback setting for osx bundle startup
	self.bundlestart.subscribe(function(opt){ self.syncsetting(opt,'OutputType',this.target); });
	self.browsers = [{n:'Chrome',v:'chrome'},{n:'Firefox',v:'firefox'},{n:'Safari',v:'safari'},{n:'Opera',v:'opera'},{n:'default',v:'default'},{n:'none',v:'NO'}];
	self.openbrowser = ko.observable('default');
	self.openbrowser.subscribe(function(opt){ self.syncsetting(opt,'browser',this.target); });
	self.datadir = ko.observable('wasabi/Wasabi data');
	self.datadir.subscribe(function(opt){ //sync datadir path setting to server and show feedback
		var dirinput = $('#datadir');
		self.syncsetting(opt,'datadir',this.target, {success: function(){ dirinput.css('border','1px solid green'); },
			error: function(){ dirinput.css('border','1px solid red'); }, after: function(msg){ dirinput.attr('title',msg); }});
	});
	self.linuxdesktop = ko.observable(true);
	self.linuxdesktop.subscribe(function(opt){ self.syncsetting(opt,'linuxdesktop',this.target); });
	self.email = false; //whether server can send emails
	self.datause = ko.observable(0); //current library size
	self.dataperc = ko.computed(function(){ return parseInt(self.datause()/(self.datalimit/100))+'%'; });
	self.joblimit = 10; //max. nr. of running jobs
	self.checkupdates = ko.observable(true);
	self.skipversion = ko.observable(0); //skip a version update
	//autosave settings
	self.undo = ko.observable(true); //save actions to history list
	self.undolength = ko.observable(5); //max lenght of actions history
	self.storeundo = false; //autosave on undo
	self.autosave = ko.observable(false); //autosave dataset to library
	self.autosaveopt = ['modification','minute','5 minutes','15 minutes','30 minutes'];
	self.autosaveint = ko.observable();
	self.intervalid = 0;
	self.autosave.subscribe(function(val){ //set up autosave
		clearInterval(self.intervalid);
		if(val && self.autosaveint()){
			if(exportmodel.savename()=='Untitled analysis') exportmodel.savename('Autosaved session');
			if(~self.autosaveint().indexOf('minute')){
				var int = parseInt(self.autosaveint());
				if(isNaN(int)) int = 1;
				self.intervalid = setInterval(savefile,int*60000);
			} else { savefile(); self.storeundo = true; }
		} else self.storeundo = false;
	});
	self.launchopt = ['blank page','import dialog','demo data','last Library item','last session'];
	self.onlaunch = ko.observable(self.launchopt[2]);
	self.onlaunch.subscribe(function(val){
		if(~val.indexOf('last')){
			if(val=='last session'){
				self.autosaveint(self.autosaveopt[0]);
				self.autosave(true);
			}
			self.keepid = true;
		} else self.keepid = false;
	});
	self.keepid = false; //save opened analysis ID
	self.keepzoom = ko.observable(true); //save zoom level
	self.keepuser = ko.observable(true); //save userID
	//UI settings
	self.tooltipclasses = ['white','black','beige'];
	self.tooltipclass = ko.observable('white');
	self.coloropt = ko.observableArray(['Taylor','Clustal','Zappo','hydrophobicity','rainbow','greyscale']);
	self.colorscheme = ko.observable('Taylor'); //sequence coloring scheme
	self.coloropt.subscribe(function(val){ self.colorscheme(val[0]); }); //seqtype will change coloropt
	self.colordesc = {rainbow:'Generates even-spaced vibrant colours.', greyscale:'Generates even-spaced greyscale tones.', custom:'Customize the tones of current colourscheme.', nucleotides:'Default colouring.'};
	self.colordesc.Taylor = self.colordesc.Clustal = self.colordesc.Zappo = self.colordesc.hydrophobicity ='One of commonly used colour schemes.';
	self.boxborder = ko.observable('border');
	self.fontopt = ['Arial','Century Gothic','Courier New','Georgia','Tahoma','Times New Roman','Verdana'];
	self.font = ko.observable('Century Gothic');
	self.remakecolors = ko.computed(function(){ //refresh canvas after settings change
		var colscheme = self.colorscheme(), border = self.boxborder(), font = self.font();
		if(!$('#settings').length||colscheme=='custom'||(colscheme=='nucleotides'&&!model.isdna())) return;
		makeColors();
		canvaslist = [];
		makeImage('','cleanup','slowfade');
		return true;
	}).extend({throttle:500});
	self.allanim = ko.observable(true);
	self.allanim.subscribe(function(val){
		if(val){ $('body').removeClass('notransition'); $.fx.off = false; }
		else{ self.windowanim(val); $('body').addClass('notransition'); $.fx.off = true; }
	});
	self.windowanim = ko.observable(true);
	self.windowanim.subscribe(function(val){ if(val) self.allanim(val); });
	self.hidebar = ko.observable(false); //hidden menubar
	self.minlib = ko.observable(false); //compact library view
	self.sharelinks = ko.observable(true);
}
var settingsmodel = new koSettings();

//main datamodel
var koModel = function(){
	var self = this;
	//system status
	self.offline = ko.observable(false);
	self.offline.subscribe(function(v){
		if(v && librarymodel.jobtimer){ clearInterval(librarymodel.jobtimer); librarymodel.jobtimer = ''; }
	});
	self.helsinki = Boolean(~window.location.hostname.indexOf('helsinki.fi'));
	self.version = {local:currentversion, remote:ko.observable(0), lastchange:''};
	//rendering parameters
	self.zlevels = [1,3,5,8,11,15,20]; //zoom level = box width (px)
	self.zoomlevel = ko.observable(5); //index of the zlevel array
	self.zoomlevel.subscribe(function(val){ if(settingsmodel.keepzoom()) localStorage.zoomlevel = JSON.stringify(val); });
	self.zoomperc = ko.computed(function(){
		var l = self.zoomlevel(), lc = self.zlevels.length-1;
		return l==0 ? 'MIN' : l==lc ? 'MAX' : parseInt(self.zlevels[l]/self.zlevels[lc]*100)+'%';
	});
	self.seqtype = ko.observable('');
	self.symbolw = ko.computed(function(){ return self.seqtype()=='codons'? 3 : 1; });
	self.boxw = ko.computed(function(){ return parseInt(self.zlevels[self.zoomlevel()]*self.symbolw()); });
	self.boxh = ko.computed(function(){ return parseInt(self.zlevels[self.zoomlevel()]*1.3); });
	self.fontsize = ko.computed(function(){ return parseInt(self.zlevels[self.zoomlevel()]*1.1); });
	self.dendogram = ko.observable(false);
	self.activeid = ko.observable(''); //id of active sequence selection area
	self.activeid.subscribe(function(newid){
		$("#seq div[class^='selection']").css({'border-color':'','color':''});
		if(newid){
	  		$('#selection'+newid+',#vertcross'+newid+',#horicross'+newid).css({'border-color':'orange','color':'orange'});
	  	}
	});
	//current data
	self.unsaved = ko.observable(false);
	self.visiblecols = ko.observableArray();
	self.visiblerows = ko.observableArray();
	self.isdna = ko.computed(function(){
		var stype = self.seqtype();
		return stype=='dna'||stype=='rna'? true : false;
	});
	self.isdna.subscribe(function(val){
		if(val) settingsmodel.coloropt(['nucleotides','rainbow','greyscale']);
		else settingsmodel.coloropt(['Taylor','Clustal','Zappo','hydrophobicity','rainbow','greyscale']);
	});
	self.hasdot = ko.observable(false);
	self.hasdot.subscribe(function(v){
		var label = v? 'del.' : 'gap';
		canvaslabels['-'] = label; canvaslabels['_'] = label;
	});
	//alignment parameteres (alignment window)
	self.gaprate = ko.computed(function(){ return self.isdna()? 0.025 : 0.005; });
	self.gapext = ko.computed(function(){ return self.isdna()? 0.75 : 0.5; });
	self.transopt = ko.computed(function(){
		var opts = [{t:'codons',v:'codon'}];
		if(self.seqtype()=='rna') opts.push({t:'mt protein',v:'mttranslate'});
		else opts.push({t:'protein',v:'translate'});
		return opts;
	});
	self.iterate = ko.observable(false);
	//sequence + tree statistics (info window)
	self.minseqlen = ko.observable(0);
	self.minseqlength = ko.computed(function(){ return numbertosize(self.minseqlen(),self.seqtype()); });
	self.maxseqlen = ko.observable(0);
	self.maxseqlength = ko.computed(function(){ return numbertosize(self.maxseqlen(),self.seqtype()) });
	self.totalseqlen = ko.observable(0);
	self.totalseqlength = ko.computed(function(){ return numbertosize(self.totalseqlen(),self.seqtype()) });
	self.alignlen = ko.observable(0);
	self.alignlength = ko.computed(function(){ return numbertosize(self.alignlen()) });
	self.alignheight = ko.computed(function(){ return self.visiblerows().length }).extend({throttle: 100});
	self.seqcount = ko.observable(0);
	self.leafcount = ko.observable(0);
	self.nodecount = ko.observable(0);
	self.hiddenlen = ko.computed(function(){ return self.alignlen()-self.visiblecols().length; }).extend({throttle: 100});
	self.hiddenlength = ko.computed(function(){ return numbertosize(self.hiddenlen(),self.seqtype()) });
	self.treesource = ko.observable('');
	self.seqsource = ko.observable('');
	self.sourcetype = ko.observable('');
	self.ensinfo = ko.observable({});
	//button menus
	self.selmodes = ['default','columns','rows'];
	self.selmode = ko.observable(self.selmodes[0]);
	self.setmode = function(mode){ self.selmode(mode); toggleselection(mode); };
	self.filemenu = ko.computed(function(){
		var online = !self.offline(), data = self.seqsource()||self.treesource(), menuarr =[];
		if(online) menuarr.push({txt:'Library',act:'library',icn:'files',inf:'Browse library of past analyses'});
		menuarr.push({txt:'Import',act:'import',icn:'file_add',inf:'Open a dataset in Wasabi'});
		if(data) menuarr.push({txt:'Export',act:'export',icn:'file_export',inf:'Convert current dataset to a file'});
		if(data && online) menuarr.push({txt:'Save',act:'save',icn:'floppy',inf:'Save current dataset to analysis library'});
		if(data) menuarr.push({txt:'Info',act:'info',icn:'file_info',inf:'View summary info about current dataset'}); 
		return menuarr;
	});
	self.runmenu = [{txt:'PRANK align',act:'align',icn:'icon_prank',inf:'Realign current sequence data'}];
	self.toolsmenu = ko.computed(function(){
		var menuarr = [], seq = self.seqsource();
		if(seq && !self.offline()) menuarr.push({txt:'PRANK alignment',act:'align',icn:'prank',inf:'Realign current sequence data'});
		if(seq) menuarr.push({txt:'Hide gaps',act:'seqtool',icn:'seq',inf:'Collapse sequence alignment columns'});
		if(self.treesource()) menuarr.push({txt:'Prune tree',act:'treetool',icn:'prune',inf:'Prune/hide tree leafs'});
		if(seq) menuarr.push({txt:'Translate',act:'translate',icn:'book_open',inf:'Translate sequence data'});
		menuarr.push({txt:'Settings',act:'settings',icn:'settings',inf:'Adjust Wasabi behaviour'});
		return menuarr;
	});
	//notifications
	self.errors = ko.observable('').extend({enable: self.helsinki}); //error reporting only for public wasabi
	self.treealtered = ko.observable(false); //tree strcture has been modified
	self.noanc = ko.observable(false); //tree has missing ancestral nodes
	self.update = ko.computed(function(){ //wasabi update available 
		return self.version.local<self.version.remote() && settingsmodel.skipversion()!=self.version.remote();
	});
	self.notifications = ko.computed(function(){ return self.treealtered()||self.update()||self.offline()||self.errors()||self.noanc(); });
	self.statusbtn = ko.computed(function(){ //construct notifications button
		var msgarr = [], running = librarymodel.runningjobs(), ready = librarymodel.readyjobs(), str = '';
		var jobs = running||ready;
		
		if(self.treealtered()) msgarr.push({short:'<span class="red">Realign</span>', long:'<span class="red">Realign needed</span>'});
		if(self.noanc()) msgarr.push({short:'<span class="orange">Ancestors</span>', long:'<span class="orange">Add ancestors</span>'})
		if(self.offline()) msgarr.push({short:'<span class="red">Offline</span>', long:'<span class="red">Offline</span>'});
		if(self.errors()){ msgarr.push({short:'<span class="red">Error</span>', long:'<span class="red">Server error</span>'}); }
		if(self.update()){ msgarr.push({short:'<span class="green">Update</span>',long:'<span class="green">Update Wasabi</span>'}); }
		
		if(jobs){
			running = running? '<span class="nr red">'+running+'</span>' : '';
			ready = ready? '<span class="nr green">'+ready+'</span>' : '';
			msgarr.push({short:running+' '+ready, long:'Jobs'+(running?' running '+running:'')+(ready?' ready '+ready:'')});
		}
		
		//build notifications button
		if(msgarr.length == 1){ str = msgarr[0].long; }
		else if(msgarr.length == 2){ str = msgarr[0].short+'<span class="btnsection">'+(jobs?'Jobs ':'')+msgarr[1].short+'</span>'; }
		else if(msgarr.length > 2){
			str = 'Alerts <span class="nr orange">'+(jobs?msgarr.length-1:msgarr.length)+'</span>';
			if(jobs) str += '<span class="btnsection">Jobs '+msgarr.pop().short+'</span>';
		}
		
		//update window title
		var title1 = ready? ready+' jobs ready' : '', alcount = jobs? msgarr.length-1 : msgarr.length, title2 = alcount>0? alcount+' alerts' : ''; 
		window.title = 'Wasabi'+ (title1||title2?' - ':'') + title1 + (title1&&title2?', ':'') + title2;
		
		if(!msgarr.length && $("#jobstatus").length) setTimeout(function(){closewindow('jobstatus')}, 1000); //close empty status window
		return str;
	}).extend({throttle: 200});
	//undo stack
	self.undostack = ko.observableArray();
	self.treebackup = '';
	self.dnasource = ko.observable('');
	self.activeundo = {name:ko.observableArray(), undone:ko.observable(''), data:ko.observable('')};
	self.refreshundo = function(data,redo){
		if(!self.undostack().length){
			self.activeundo.name.removeAll(); 
			self.activeundo.data('');
		} else {
			if(!data) data = self.undostack()[0];
			var name = data.name.length>8? data.name.split(' ')[0] : data.name;
			if(redo) self.activeundo.name()[0].name(name);
			else { self.activeundo.name.removeAll(); self.activeundo.name.push({name:ko.observable(name)}); }
			self.activeundo.undone(false);
			self.activeundo.data(data);
		}
	};
	self.selectundo = function(data){
		if(data==='firsttree') data = self.gettreeundo('first');
		self.refreshundo(data,'select');
	};
	self.addundo = function(undodata,redo){
		if(!settingsmodel.undo()) return; //undo disabled
		if(undodata.type=='tree'&&undodata.info.indexOf('also')==-1) undodata.info += ' Undo also reverts any newer tree changes above.';
		self.undostack.unshift(undodata);
		if(self.undostack().length>settingsmodel.undolength()) self.undostack.pop();
		self.refreshundo(undodata,redo);
		model.unsaved(true);
		if(settingsmodel.storeundo) savefile();
	};
	self.undo = function(){
		var undone = self.activeundo.undone;
		var data = self.activeundo.data();
		if(!data||undone()) return;
		if(data.type=='tree'){
			var undoindex = self.undostack.indexOf(data);
			var restore = self.gettreeundo('prev',undoindex).data||self.treebackup;
			treesvg.loaddata(restore);
			self.gettreeundo('remove',undoindex);
		}
		else if(data.type=='seq') undoseq(data.data, data.undoaction);
		self.undostack.remove(data);
		undone(true); model.unsaved(true);
		if(settingsmodel.storeundo) savefile();
	};
	self.redo = function(){
		var undone = self.activeundo.undone;
		var data = self.activeundo.data();
		if(!data||!undone()) return;
		if(data.type=='tree') treesvg.loaddata(data.data);
		else if(data.type=='seq') undoseq(data.data, data.redoaction);
		self.addundo(data,'redo'); model.unsaved(true);
		if(settingsmodel.storeundo) savefile();
	};
	self.gettreeundo = function(mode,index){
		var start = mode=='prev'? index+1 : 0;
		var end = mode=='remove'? index : self.undostack().length-1;
		var found = false;
		for(var i=end;i>=start;i--){
			if(self.undostack()[i].type=='tree'){
				found = self.undostack()[i];
				if(mode=='first') break;
				if(mode=='remove') self.undostack.splice(i,1);
			} 
		}
		return found;
	};
};//koModel
var model = new koModel();


//file export settings (export window)
var koExport = function(){
	var self = this;
	self.categories = ko.computed(function(){
		var catarr = [];
		if(model.seqsource()) catarr.push({name:'Sequence', formats:[{name:'fasta', variants:[{name:'fasta', ext:['.fa']} ]} ]}); 
		if(model.treesource()) catarr.push({name:'Tree', formats:[ 
			{name:'newick', variants:[
				{name:'newick', ext:['.nwk','.tre','.tree']},
				{name:'extended newick', ext:['.nhx'], desc:'Newick format with additional metadata (hidden nodes etc.)'}
			]} 
		]});
		if(catarr.length==2){
			catarr.push({name:'Sequence+tree', formats:[{name:'HSAML', variants:[{name:'HSAML', ext:['.xml'], 
			desc:'XML format which supports additional data from PRANK alingments. Click for more info.', url:'http://prank-msa.googlecode.com'} ]} ]});
		}
		else if(!catarr.length){ catarr = [{name:'',formats:[{name:'',variants:[{name:'',ext:['']}]}]}]; }
		return catarr;
		//{name:'Phylip',fileext:'.phy',desc:'',interlace:true}, {name:'PAML',fileext:'.phy',desc:'Phylip format optimized for PAML',hastree:false,interlace:false}, 
		//{name:'RAxML',fileext:'.phy',desc:'Phylip format optimized for RAxML',hastree:false,interlace:false};
	});
	self.category = ko.observable({});
	self.format = ko.observable({});
	self.format.subscribe(function(f){ if(f.name=='HSAML') self.includetree(true); });
	self.variant = ko.observable({});
	self.infolink = ko.computed(function(){ return self.variant().url?'window.open(\''+self.variant().url+'\')':false });
	self.filename = ko.observable('Untitled');
	self.fileext = ko.observable('.fa');
	self.fileurl = ko.observable('');
	self.includetree = ko.observable(false);
	self.includeanc = ko.observable(false);
	self.includehidden = ko.observable(true);
	self.interlaced = ko.observable(false);
	self.maskoptions = ['lowercase','N','X'];
	self.masksymbol = ko.observable('lowercase');
	self.trunc = ko.observable(false);
	self.truncsymbol = ko.observable('');
	self.trunclen = ko.observable('');
	//Save window preferences
	self.savetargets = ko.computed(function(){
		if(librarymodel.openid()){
			var targets = [{name:'overwrite of current',type:'overwrite'},{name:'child of current',type:'child'},{name:'new',type:'new'}];
			if(librarymodel.openparent()) targets.push({name:'sibling of current',type:'sibling'});
		} else { var targets = [{name:'new',type:'new'}]; }
		return targets;
	}).extend({throttle:3000});
	self.savetarget = ko.observable({});
	self.savename = ko.observable('Untitled analysis');
}
var exportmodel = new koExport();

//Datamodel for seq. tools (hiding cols)
var koTools = function(){
	var self = this;
	self.hidelimit = ko.observable(5);
	self.minhidelimit = ko.computed({
		read: function(){ return self.hidelimit()==1; },
		write: function(checked){ if(checked) self.hidelimit(1); }
	});
	self.hidelimitperc = ko.computed({
		read: function(){
			var limit = self.hidelimit(), rowc = model.visiblerows().length;
			if(limit<0) self.hidelimit(0); else if(limit>rowc) self.hidelimit(rowc);
			return Math.round(limit/rowc*100);
		},
		write: function(perc){
			if(perc<0) prec = 0; else if(perc>100) perc = 100;
			self.hidelimit(Math.round(perc/100*model.visiblerows().length));
		}
	});
	self.gapcount = [];
	self.gaptype = ko.observable('');
	self.gaptype.subscribe(function(){self.countgaps()});
	self.countgaps = function(){ //setup: count gaps in alignment columns
		var l = '', gaps = [], rows = model.visiblerows(), cols = model.visiblecols();
		self.gapcount = [];
		if(!model.hasdot()||~self.gaptype().indexOf('in')) gaps.push('.',':');
		if(!model.hasdot()||~self.gaptype().indexOf('del')) gaps.push('-','_');
		for(var c=model.alignlen(); c--;) self.gapcount[c] = 0;
		$.each(rows,function(n,name){
			$.each(cols,function(i,c){ if(~gaps.indexOf(sequences[name][c])) self.gapcount[i]++; }); //note: takes time on large data
		});
		self.hidelimitperc(10);
	};
	self.gaplen = ko.observable(0);
	self.buflen = ko.observable(0);
	self.hidecolcount = ko.computed(function(){ //preview result
		var colestimate = 0, rows = model.visiblerows().length, threshold = self.hidelimit(), range = [], ranges = [], dialog = $('#seqtool').length;
		var minlen = parseInt(self.gaplen()), buflen = parseInt(self.buflen());
		if(minlen<0){ minlen=0; self.gaplen(0); }
		if(buflen<0){ buflen=0; self.buflen(0); }else if(minlen<buflen*2){ buflen = parseInt((minlen-1)/2); self.buflen(buflen); }
		var processrange = function(c){
			range[1] = c; var rangespan = range[1]-range[0];
			if(rangespan>minlen){ range[0]+=buflen; range[1]-=buflen; ranges.push(range); colestimate += rangespan-(2*buflen); }
			range = [];
		};
		$.each(self.gapcount,function(c,gaps){
			if(rows-gaps<threshold){ if(!range.length) range[0] = c; }
			else if(range.length) processrange(c);
		});
		if(range.length) processrange(self.gapcount.length);
		if(dialog){ //preview, mark columns
			setTimeout(function(){
				colflags = []; clearselection(); if(model.selmode()!='columns') model.selmode('columns');
				$.each(ranges,function(i,carr){ selectionsize('','',carr); for(var r=carr[0];r<carr[1];r++){ colflags[r] = 1; }});
			}, 100);
		}
		return colestimate;
	}).extend({throttle:500});
	self.hidecolperc = ko.computed(function(){ return parseInt(self.hidecolcount()/self.gapcount.length*100) });
	
	self.prunemode = false;
	self.leafaction = ko.observable();
	self.leafsel = ko.observable();
	self.markLeafs = function(unmark){
		if(unmark){ $.each(leafnodes,function(n,node){ if(node.active) node.highlight(false); }); return; }
		registerselections();
		$.each(model.visiblerows(),function(r,name){ if(rowflags[r]&&leafnodes[name]) leafnodes[name].highlight(true); });
	};
	self.processLeafs = function(func,affected){ //hide/remove all marked/unmarked leafs
		if(typeof(func)!='string'){
			var markedcount = $('#names tspan[fill=orange]').length;
			var target = self.leafsel()=='unmarked'? false : true;
			var affected = target? markedcount : model.visiblerows().length-markedcount;
			var func = self.leafaction()=='prune'? 'remove':'hideToggle';
			if(!affected || model.visiblerows().length-affected<4){
				var errtxt = func=='remove'? 'Can\'t prune: ':'Can\'t hide: ';
				errtxt += !affected? 'nothing to '+self.leafaction()+'.' : 'less than 4 leafs would remain.';
				$('#treetoolerror').text(errtxt);
				setTimeout(function(){$('#treetoolerror').empty()},3000); return;
			}
		} else var target = true; //process premarked leafs
		//if(!model.treebackup) model.treebackup = treesvg.data.root.removeAnc().write('tags');
		$.each(leafnodes,function(n,node){ if(node.active==target) node[func]('hide','nocount'); });
		treesvg.refresh();
		var actdesc = func=='remove'? 'removed' : 'hidden', actname = func=='remove'? 'Remove' : 'Hide';
		model.addundo({name:actname+' leafs',type:'tree',data:treesvg.data.root.removeAnc().write('undo'),info:affected+' leafs were '+actdesc+'.'});
		closewindow('treetool');
	};
};
var toolsmodel = new koTools();

//HTML element transitions for KO viewmodel items
ko.bindingHandlers.fadevisible = {
	init: function(element){ $(element).css('display','none') },
    update: function(element, value){
        var value = ko.utils.unwrapObservable(value());
        if(value) $(element).fadeIn(); else $(element).hide();
    }
};
ko.bindingHandlers.slidevisible = {
	init: function(element){ $(element).css('display','none') },
    update: function(element, value){
        var value = ko.utils.unwrapObservable(value());
        if(value) $(element).slideDown(); else $(element).slideUp();
    }
};
ko.bindingHandlers.fadeText = {
    update: function(element, valueAccessor){
  		$(element).hide();
        ko.bindingHandlers.text.update(element, valueAccessor);
        $(element).fadeIn(200);
    }        
};
var slideadd = function(el){ $(el).css('display','none'); $(el).slideDown() };
var slideremove = function(el){ $(el).slideUp(400,function(){ $(this).remove() }) };
var marginadd = function(elarr){ setTimeout(function(){ elarr[0].style.marginTop = 0; },50); };
var waitremove = function(el){ setTimeout(function(){ $(el).remove() },500) };


function numbertosize(number,type,min){ //prettyformat a number
	if(isNaN(number)) return number;
	if(!type) type = '';
	else if(type=='dna'||type=='rna') type = 'bp';
	else if(type=='protein') type = 'residues';
    var sizes = type=='bp' ? [' bp',' kb',' Mb',' Gb'] : type=='byte' ? [' Bytes', ' KB', ' MB', ' GB'] : type=='sec'? [' sec',' min :',' h :'] : ['', '&#x2217;10<sup>3</sup>', '&#x2217;10<sup>6</sup>', '&#x2217;10<sup>9</sup>'];
    var order = type=='bp' ? 1024 : 1000;
    if(!min){ var min = type=='bp'||type=='byte'||type=='sec'? order : 1000000; }
    number = parseInt(number);
    if (number < min) return number+(sizes[0]||' '+type);
    var i = 0;
    if(type=='sec'){
    	var str = '';
    	while(number>=order && i<sizes.length-1){ str = (number%order)+sizes[i]+' '+str; number = number/order; i++; }  
    	return str; //"3 h : 12 min : 36 sec"
    }
    else{
    	while(number>=order && i<sizes.length-1){ number = number/order; i++; }  
    	return number.toFixed(1).replace('.0','')+(sizes[i]||' '+type); //"2 KB"; "1.3 Mb";
    }
};

function msectodate(msec){ //convert datestamps to  dates
	if(typeof(msec)=='function') msec = msec();
	if(!msec || isNaN(msec)) return 'Never';
	var t = new Date(parseInt(msec)*1000);
	return ('0'+t.getDate()).slice(-2)+'.'+('0'+(t.getMonth()+1)).slice(-2)+'.'+t.getFullYear().toString().substr(2)+
	  ' at '+t.getHours()+':'+('0'+t.getMinutes()).slice(-2);
}

function parseurl(url){ //get variables from url as Object
	if(!url) url = window.location.search;
	if(~url.indexOf('?')){ url = url.split('?')[1]; }else{ return {}; }
	try{ return JSON.parse('{"'+decodeURI(url).replace(/&/g,'","').replace(/=/g,'":"')+'"}'); }
	catch(e){ console.log('URL error: '+e); return {}; }
}


//toolbar title pop-up menu
function titlemenu(e){
	e.preventDefault();
	e.stopPropagation();
	var $input = $('#toptitle>input');
	if($input.hasClass('editable')) return false;
	var title = '';
	var menudata = {'Rename':function(){$input.addClass('editable'); $input.focus();}, 
		'Save':function(){savefile()}, 'Export':function(){dialog('export')}};
	if(librarymodel.openid()) menudata['View in Library'] = function(){dialog('library')};
	else title = 'Not in Library';
	tooltip('',title,{target:$('#toptitle'), arrow:'top', shifty:-5, data:menudata, style:'white greytitle', id:'titlemenu'});
}

//titlebar menus
function topmenu(e,btn,menuid){
	var $btn = $(btn);
	e.preventDefault();
	e.stopPropagation();
	var title = '', menudata = {};
	if(!menuid) menuid = $btn.attr('id')+'menu';
	var modeldata = model[menuid]() || {};
	$.each(modeldata, function(i,rdata){
		var row = {};
		if(menuid == 'undostack'){
			rdata.txt = i;
			row.txt = rdata.name;
			row.icon = rdata.type;
			row.t = rdata.info;
			row.css = {backgroundColor: rdata==model.activeundo.data()?'#ffcc66':'' };
			row.click = function(){ model.selectundo(rdata) };
		} else {
			row.click = function(){dialog(rdata.act)};
			row.icon = rdata.icn;
			row.t = rdata.inf;
			row.css = rdata.css||'';
		}
		if(!row.click) return true;
		else menudata[rdata.txt] = row;
	});
	if(!Object.keys(menudata).length) title = 'No items';
	tooltip('',title,{clear:true, target:btn, arrow:'top', data:menudata, style:'white topmenu greytitle', id:menuid});
}

//hide/expand toolbar
function toggletop(collapse){
	if(typeof(collapse)=='undefined') collapse = !$('body').hasClass('mintop');
	else if(collapse==$('body').hasClass('mintop')) return;
	var arrows = $('#topcollapse>span');
	if(collapse){
		localStorage.collapse = "collapse";
		$('body').addClass('mintop');
		setTimeout(function(){
			arrows.html('&#x25BC;<br>&#x25BC;');
			$('#top .toptext, #top .title, #bottom').css('display','none');
			$('#top').addClass('hidden');
			$(window).trigger('resize');
		},800);
	} else {
		localStorage.collapse = "";
		$('#top .toptext, #bottom').css('display','');
		if(!model.offline()) $('#top .title').css('display','');
		setTimeout(function(){ $('body').removeClass('mintop') },100);
		setTimeout(function(){
			arrows.html('&#x25B2;<br>&#x25B2');
			$(window).trigger('resize');
			$('#top').removeClass('hidden');
		},800);
	}
	
}

//send and receive(+save) data from local server fn(str,obj,[str|obj])
function communicate(action,senddata,options){
	if(!action) return false;
	if(model.offline()) action = 'checkserver';
	if(!options) options = {};
	else if(typeof(options)=='string') options = {saveto:options,retry:true}; //retry in case of error
	if(!senddata) senddata = {};
	if(settingsmodel.userid){ senddata.userid = settingsmodel.userid; }
	
	var formdata = options.form? new FormData(options.form) : new FormData();
	formdata.append('action',action);
	$.each(senddata,function(key,val){
		if(typeof(val)=='object') val = JSON.stringify(val);
		if(typeof(val)!='undefined') formdata.append(key,val);
	});
	if(options.btn && options.btn.jquery) options.btn = options.btn[0];
	var btntxt = options.btntxt || (options.btn? options.btn.innerHTML : '');
	var retryfunc = function(){ communicate(action,senddata,options) }; //resend request
	var restorefunc = function(){ //restore original button function
		if(options.btn){
    		if(!~btntxt.indexOf('spinner')) options.btn.innerHTML = btntxt;
    		options.btn.title = '';
    		$(options.btn).off('click').click(retryfunc);
    	}
    }
    
    var parseResp = function(data, isJSON){ //check and parse server response
    	var errmsg = '', resp = data;
    	if(isJSON){ try{ resp = JSON.parse(data); }catch(e){ if(isJSON!='guess') errmsg = 'Unexpected response: '+e; } }
    	if(~data.indexOf('Error response')){ errmsg = data.match(/Message:(.+)/im)[1]; }
    	if(errmsg){
    		if(errorfunc) errorfunc(errmsg);
    		console.log(errmsg);
    		resp = false;
    	}
    	return resp;
    }
    
    var successfunc = errorfunc = '';
    if(action=='save'){
		successfunc = function(data){
    		resp = parseResp(data,'json');
    		if(!resp) return;
    		librarymodel.openid(resp.id);
    		if(settingsmodel.keepid){
    			localStorage.openid = JSON.stringify(resp.id);
    			localStorage.openfile = JSON.stringify(resp.name);
    		}
    		if(options.btn) options.btn.innerHTML = 'Saved';
   		}
   	}
   	else if(action=='getimportmeta'){ if(!options.saveto) options.saveto = 'import'; }
   	else if(action=='getlibrary'){ if(!options.saveto) options.saveto = 'library'; }
   	else if(action=='checkserver'){
   		errorfunc = function(msg){ if(~msg.indexOf('No response')) model.offline(true); };
   		successfunc = function(resp){
   			try{
   				var data = JSON.parse(response);
   				if(data){
   					model.offline(false);
   					setTimeout(function(){communicate('getlibrary')},700);
   				}
   			}catch(e){ model.offline(true); }};
    }
    if(typeof(options.success)=='function') successfunc = options.success;
    if(typeof(options.error)=='function') errorfunc = options.error;
    else if(options.btn){ errorfunc = function(errmsg){
    	options.btn.innerHTML = '<span class="label red" title="Error message: '+errmsg+'">Error</span>';
    	setTimeout(restorefunc, 3000);
    }}
    
    var afterfunc = ''; //follow-up (data sync) after change-data-request to server
    var actionnr = ['writemeta','terminate','save','startalign','rmdir'].indexOf(action);
    if(~actionnr){
      afterfunc = function(){
      	if (action=='save') model.unsaved(false);
      	if(settingsmodel.datalimit && actionnr>1){ //files added/removed. Get new library size.
      		communicate('checkserver','',{success:function(data){data=JSON.parse(data); settingsmodel.datause(parseInt(data.datause));}});
      	}
    	communicate('getlibrary');
      }
    }
    if(typeof options.after=='function') afterfunc = options.after;
    		
	return $.ajax({
		type: "POST",
		url: 'index.html',
		beforeSend : function(xhrobj){
			if(options.btn){
				options.btn.innerHTML = '<img src="images/spinner.gif" class="icn"/>';
				if(!~['terminate','rmdir'].indexOf(action)){ //make process abortable with action/closebutton
					options.btn.title = 'Click to abort';
					$(options.btn).off('click').click(function(){xhrobj.abort()});
					closewindow(options.btn,function(){xhrobj.abort()}); //add call aborting to closebtn
				}
			}
		},
    	success: function(data){
    		if(options.saveto){ //save data from server
    			resp = parseResp(data,'guess');
    			if(typeof(options.saveto)=='string'){ //save to 'serverdata' array
    				if(typeof(serverdata[options.saveto])=='function'){ //map to datamodel
    					ko.mapping.fromJS(resp, serverdata[options.saveto]);
    				} else { serverdata[options.saveto] = resp; } //plain copy
    			}
    			else if(typeof(options.saveto)=='function'){ options.saveto(resp); }//save to an observable
    		}
    		else if(options.btn && !successfunc){ //show feedback on button
    			var resp = parseResp(data,'guess');
    			if(!resp) return;
    			if(typeof(resp)=='string') options.btn.innerHTML = resp;
    			else if(resp.file) options.btn.href = resp.file;
    			if($(options.btn).css('opacity')==0) $(options.btn).css('opacity',1); //show downloadlink_btn
    		}
    		
    		if(parseResp(data)){ //no errors
    			if(successfunc) successfunc(data); //custom successfunc (data processing/import)
    			if(options.restore) setTimeout(restorefunc, 3000); //restore original button state
    		}
    		if(afterfunc) setTimeout(function(){ afterfunc(data||''); }, 500); //follow-up (data sync)
    	},
    	timeout: options.timeout||0,
    	error: function(xhrobj,status,msg){
    		if(status!="abort"){
    			if(status=="timeout" && options.fabtn){ closewindow(options.btn); }
    		    if(msg){ //server responded with error
    		    	if(model.helsinki){ //for public Wasabi, log&send errors
    		    		var date = new Date();
    		    		date = date.toISOString();
    		    		date = date.substr(0,date.lastIndexOf('.'));
    		    		var optstr = JSON.stringify(senddata);
    		    		if(optstr.length>60) optstr = optstr.substring(0,57)+'...';
    		    		var errorstr = ' *'+date+' "'+msg+'" when requesting "'+action+'" with '+optstr;
    		    		model.errors(model.errors()+errorstr); //notify user
    		    		if(action!='errorlog') communicate('errorlog',{errorlog:errorstr}); //send error to server
    		    	}
    		    	console.log('Wasabi server responded to "'+action+'" with error: '+msg);
    		    	if(errorfunc) errorfunc(msg);
    		    }
    		    else{ //no response
        			if(options.retry){ //allow 2 retries
        				options.retry = options.retry=='take2'? false : 'take2';
        				if(btntxt) options.btntxt = btntxt;
        				setTimeout(retryfunc, 2000); return;
        			}
        			msg = 'No response from server. Try again.';
        			if(status=="error" && !xhrobj.responseText) model.offline(true);
        			if(errorfunc) errorfunc(msg);
        		}
        	}
        	else if(options.btn){
        		options.btn.innerHTML = '<span class="label red" title="Error message:'+msg+'">Aborted</label>';
        		setTimeout(restorefunc,3000);
        	}
    		
    		if(afterfunc) setTimeout(function(){ afterfunc(msg||''); }, 500); //follow-up (data resync)
    	},
    	xhr: function(){
 			var xhr = $.ajaxSettings.xhr();
 			if(options.btn){ //show file transfer feedback
 				xhr.tick = 1;
 				var desc = 'Downloading';
 				var listenfunc = function(d){
        			if(d.total && !(xhr.tick%2)){
        				var perc = parseInt(d.loaded/(d.total/100));
        				options.btn.innerHTML = '<span class="progressline"><span class="bar" style="width:'+perc+'%">'+
        				'<span class="title">'+desc+'</span></span></span>';
        			}
        			xhr.tick++;
        		};
        		if(action=='geturl'||action=='update'){ //listen for file download progress
        			xhr.addEventListener('progress',listenfunc,false);
        		} else if(xhr.upload){ //listen for file upload progress
        			desc = 'Uploading';
        			xhr.upload.addEventListener('progress',listenfunc,false);
        		}
 			}
        	return xhr;
  		},
    	data: formdata,
    	dataType: "text",
        cache: false,
        contentType: false,
        processData: false
    });
}


/*function togglemenu(event){ //show/hide dropdown menus
	if(event){ //show clicked menu
		var menudiv = $('div.buttonmenu',event.currentTarget.parentElement);
		if(menudiv.parent().hasClass('visible') || !$('li',menudiv).length) return;
		menudiv.parent().addClass('visible');
		menudiv.css('margin-top',-1);
		$("#top").css('top',0);
		setTimeout(function(){ $("body").one('click',function(){togglemenu('')}); },500);
	}
	else{ //hide all menus
		$.each($('div.buttonmenu'),function(){
			var self = $(this);
			self.parent().removeClass('visible');
			self.css('margin-top',0-self.height()-6);
		});
		$("#top").css('top','');
	}
}*/


/* Input file parsing */
function parseimport(options){ //options{dialog:jQ,update:true,mode}
	if(!options) options = {};
	if(!options.mode) options.mode = '';
	var errors = [], notes = [], treeoverwrite = false, seqoverwrite = false;
	var Tidnames = {}, Tsequences = '', Ttreedata = '', Ttreesource = '', Tseqsource = '', Tseqformat = '';
	var metaidnames = {}, nodeinfo = {}, visiblecols = [];
	var ensinfo = options.ensinfo || {};
	if(options.id){ //item imported from library. Get metadata.
		if(serverdata.import.id && serverdata.import.id==options.id){
			metaidnames = serverdata.import.idnames || {};
			nodeinfo = serverdata.import.nodeinfo || {};
			ensinfo = serverdata.import.ensinfo || {};
			visiblecols = serverdata.import.visiblecols || [];
		}
		if(options.share) options.source = 'shared data';
		//if(!options.source) options.source = serverdata.library.getItemByIndex(options.id).source||'import';
	}
	
	var parseseq = function(seqtxt,filename,format,nspecies,nchars){
		if(Tsequences) seqoverwrite = true;
		Tsequences = {};
   		Tseqsource = filename;
   		
   		var iupac = 'ARNDCQEGHILKMFPSTUWYVBZX\\-?*';
   		var seqstart = new RegExp('\\s(['+iupac+']{10}\\s?['+iupac+']{10}.*)$','img');
   		if(format=='clustal'){ //remove clustal-specific additions
   			seqtxt = seqtxt.replace(/ {1}\d+$/mg,'');
   			seqtxt = seqtxt.replace(/^[ \:\.\*]+$/mg,'');
   		}
   		else if(format=='nexus'){ seqtxt = seqtxt.replace(/\[.+\]/g,''); } //remove "[]"
   		else if(format=='phylip' && nspecies){ //detect & reformat strict phylip
   			var strictphy = false;
   			var capture = seqstart.exec(seqtxt);
   			if(capture){
   				var linelength = capture[1].length;
   				for(var s=1;s<nspecies;s++){
   					capture = seqstart.exec(seqtxt);
   					if(linelength != capture[1].length){ strictphy = true; break; }
   					linelength = capture[1].length;
   				}
   				seqstart.lastIndex = 0;
   			} else { strictphy = true; }
   			if(strictphy){ seqtxt = seqtxt.replace(/^ *.{10}/gm,"$& "); }
   		}
   		seqtxt = seqtxt.replace(/ *[\n\r]\s*/g,'\n'); //collapse multilines+whitespace
   		seqtxt = seqtxt.replace(/ {2,}/g,' ');
   		var taxanames = [], bookmark = 0, interleaved = false, firstseqline = true, name = '';
   		var repeatingnames = format=='phylip'? false : true;
   		while(capture = seqstart.exec(seqtxt)){ //get names & first sequences
   			var seqarr = capture[1].replace(/ /g,'').split('');
   			if(bookmark < capture.index){ //found name btwn sequences
   				name = seqtxt.substring(bookmark+1,capture.index);
   				name = name.trim(name);
   				if(Tsequences[name]){ interleaved = true; repeatingnames=name; break; }
   				Tsequences[name] = seqarr; taxanames.push(name);
   			}
   			else{ //found sequential sequence line
   				if(firstseqline){ if(taxanames.length>1){ interleaved = true; repeatingnames=false; break; } firstseqline = false; }
   				Tsequences[name].push.apply(Tsequences[name],seqarr);
   			}
   			bookmark = seqstart.lastIndex;
   		}
   		if(interleaved){ //continue parsing for interleaved seq.
   			var fulline = /^.+$/gm;
   			fulline.lastIndex = bookmark;
   			var nameind = 0, name = '';
   			while(capture = fulline.exec(seqtxt)){
   				var name = taxanames[nameind];
   				name = name.trim(name);
   				if(repeatingnames){
   					if(capture[0].indexOf(name)!=0){ errors.push("Non-unique taxa name found!<br>("+repeatingnames+")"); break; }
   					seqarr = capture[0].substr(name.length).replace(/ /g,'').split('');
   				}
   				else seqarr = capture[0].replace(/ /g,'').split('');
   				Tsequences[name].push.apply(Tsequences[name],seqarr);
   				nameind++; if(nameind==taxanames.length) nameind = 0;
   			}
   		}
   		if(nspecies && errors.length==0 && taxanames.length!=nspecies) notes.push("Number of taxa found doesn't match <br>the file metainfo ("+nspecies+", "+taxanames.length+" found)");
   		if(nchars && errors.length==0 && Tsequences[taxanames[0]].length!=nchars) notes.push("The sequence length doesn't match <br>the file metainfo ("+nchars+" chars, "+Tsequences[taxanames[0]].length+" found)");			
	};
	
	var parsenodeseq = function(){
		var self = $(this);
   		var id = self.attr("id");
   		var name = self.attr("name") || id;
   		if(metaidnames[name]) name = metaidnames[name];
   		name = name.replace(/_/g,' ')
   		name = name.trim(name);
   		if(~name.indexOf('#')) name = 'Node '+name.replace(/#/g,'');
   		if(id!=name) Tidnames[id] = name;
   		var tmpseq = self.find("sequence").text();
   		if(tmpseq.length != 0){
   			tmpseq = tmpseq.replace(/\s+/g,'');
   			if(Tsequences[name]){ errors.push("Non-unique taxa name found!<br>("+name+")"); }
   			Tsequences[name] = tmpseq.split('');
   		}
   	};
	
	var parsetree = function(treetxt,filename,format){ //import tree data
		if(Ttreedata) treeoverwrite = true;
		Ttreedata = {};
		Ttreesource = filename;
		if(!format) format = 'newick';
		if(format=='newick'){ //remove whitespace
			if(Tseqformat=='fasta'){ //match fasta name truncating
				//treetxt = treetxt.replace(/(['"]\w+)[^'"]+(['"])/g,"$1$2");
			}
			treetxt = treetxt.replace(/\n+/g,'');
		}
		Ttreedata[format] = treetxt;
		if(format=='phyloxml' && ~treetxt.indexOf('<mol_seq')){ //sequences in tree data
			if(Tsequences) seqoverwrite = true;
			Tsequences = 'phyloxml';
   			Tseqsource = filename;
		}
	};
	
	var filenames = options.filenames || Object.keys(filescontent);
	filenames.sort(function(a,b){ //sort filelist: [nexus,xml,phylip,...,tre]
		if(/\.tre/.test(a)) return 1; else if(/\.tre/.test(b)) return -1;
		return /\.ne?x/.test(a)? -1: /\.xml/.test(a)? /\.ne?x/.test(b)? 1:-1 : /\.ph/.test(a)? /\.ne?x|\.xml/.test(b)? 1:-1 : /\.ne?x|\.xml|\.ph/.test(b)? 1: 0;
	});
	
	var datatype = '';
	$.each(filenames,function(i,filename){
		var file = filescontent[filename], marr = [], result = [];
		if(typeof(file)=='object' && file.hasOwnProperty('data')){ //Ensembl JSON object
			if(!file.data[0].homologies) return;
			var gotsource = false; Tsequences = {};
			$.each(file.data[0].homologies,function(j,data){
				if(!gotsource){
					var species = data.source.species.replace('_',' ');
					Tsequences[data.source.id] = data.source["align_seq"].split('');
					ensinfo.species = species;
					nodeinfo[data.source.id] = {genetype:'source gene', cladename:data.source.id, species:species, accession:data.source.protein_id};
					gotsource = true;
				}
				var species = data.target.species.replace('_',' ');
				Tsequences[data.target.id] = data.target["align_seq"].split('');
				nodeinfo[data.target.id] = {genetype:data.type.replace(/_/g,' ').replace('2',' to '), cladename:data.target.id, species:species, 
				accession:data.target.protein_id, srate:data.target.dn_ds, taxaname:data.subtype, identity:data.target.perc_id};
			});
		}
		else if(typeof(file)!='string'){ errors.push("Unrecognized data format in "+filename); return true; }
		else if(/^<.+>$/m.test(file)){ //xml
			if(~file.indexOf("<phyloxml")){ //phyloxml tree
				if(options.mode=='check'){ datatype += 'tree '; return true; }
				parsetree(file,filename,'phyloxml');
			}
			else{  //HSAML
			  var newickdata = $(file).find("newick");
			  if(newickdata.length != 0){
			  	if(options.mode=='check') datatype += 'tree ';
			  	else parsetree(newickdata.text(),filename);
			  }
			  var leafdata = $(file).find("leaf");
			  if(leafdata.length != 0){
			  	if(options.mode=='check') datatype += 'seq ';
			  	else { if(Tsequences) seqoverwrite = true; Tsequences = {}; Tseqsource = filename; }
			  }
			  if(options.mode=='check') return true;
   			  leafdata.each(parsenodeseq);
   			  var nodedata = $(file).find("node");
   			  nodedata.each(parsenodeseq);
   			}
   			//if(newickdata.length!=0 && leafdata.length!=0){ return false }//got data, no more files needed
   		}
   		else if(/^>.+$/m.test(file)){ //fasta
   			if(options.mode=='check'){ datatype += 'seq '; return true; }
   			if(Tsequences) seqoverwrite = true;
   			else Tsequences = {};
   			Tseqsource += ' '+filename; Tseqformat = 'fasta';
   			var nameexp = /^>(.+)$/mg;
   			while(result = nameexp.exec(file)){ //find nametags from fasta
   				var to = file.indexOf(">",nameexp.lastIndex);
   				if(to==-1){ to = file.length; }
   				var tmpseq = file.substring(nameexp.lastIndex,to); //get text between fasta tags
   				tmpseq = tmpseq.replace(/\s+/g,''); //remove whitespace
   				var name = result[1];
   				name = name.trim(name);
   				if(Tsequences[name]){ errors.push("Non-unique taxa name found!<br>("+name+")"); return false; }
   				Tsequences[name] = tmpseq.split('');
   			}
   		}
   		else if(/^clustal/i.test(file)){ //Clustal
   			if(options.mode=='check'){ datatype += 'seq '; return true; }
   			file = file.substring(file.search(/[\n\r]+/)); //remove first line
   			parseseq(file,filename,'clustal');
   		}
   		else if(marr = file.match(/^\s*(\d+) {1}(\d+) *[\n\r]/)){ //phylip alignment
   			if(options.mode=='check'){ datatype += 'seq '; return true; }
   			file = file.substring(file.search(/[\n\r]/)); //remove first line
   			parseseq(file,filename,'phylip',marr[1],marr[2]);
   		}
   		else if(~file.indexOf("#NEXUS")){ //NEXUS
   			var blockexp = /begin (\w+);/igm;
   			var hastree = false, hasseq = false;
   			while(result = blockexp.exec(file)){ //parse data blocks
   				var blockname = result[1].toLowerCase();
   				if(blockname=='trees'||blockname=='data'||blockname=='characters'){
   					if(blockname=='trees'){
   						if(options.mode=='check'){ datatype += 'tree '; continue; }
   						var blockstart = file.indexOf('(',blockexp.lastIndex);
   						var blockend = file.indexOf(';',blockstart);
   						var blocktxt = file.substring(blockstart,blockend);
   						parsetree(blocktxt,filename);
   						hastree = true;
   					}
   					else if(blockname=='data'||blockname=='characters'){
   						if(options.mode=='check'){ datatype += 'seq '; continue; }
   						if(marr = file.match(/ntax=(\d+)/i)) var ntax = marr[1]; else var ntax = '';
   						if(marr = file.match(/nchar=(\d+)/i)) var nchar = marr[1]; else var nchar = '';
   						var blockstart = file.indexOf(file.match(/matrix/i)[0],blockexp.lastIndex);
   						var blockend = file.indexOf(';',blockstart);
   						var blocktxt = file.substring(blockstart+6,blockend);
   						parseseq(blocktxt,filename,'nexus',ntax,nchar);
   						hasseq = true;
   					}
   				}
   			}
   			if(hastree && hasseq) return false; //got tree+seq: break
   		}
   		else if(/^\s?\(+\s?(\w+|['"][^'"]+['"])(:\d+\.?\d*)?,\s?[('"\w]+/.test(file)){ //newick tree
   			if(options.mode=='check'){ datatype += 'tree '; return true; }
   			parsetree(file,filename);
   		}
   		else{
   			errors.push("Unrecognized data format in "+filename);
   		}
	});//for each file
	if(options.mode=='check') return datatype;
	filescontent = {};
	
	if(options.mode=='importcdna'){
		if(!Tseqsource) errors.push('No sequence data found');
		else if(~Tsequences[Object.keys(Tsequences)[0]].join('').search(/[^ATGCNUX.:?!_-]/ig)){
			errors.push('Provided data doesn\'t seem to be a DNA sequence');
		}
	}
	
	if(errors.length){ //diplay errors. no import
		var ul = $('<ul>').css({'color':'red','white-space':'normal'});
		$.each(errors,function(j,err){ ul.append('<li>'+err+'</li>') });
		if(options.dialog) $('.errors',options.dialog).empty().append('<br><b>File import errors:</b><br>',ul,'<br>');
		else dialog('error',['File import failed:','<br>',ul,'<br>']);
		return false;
	} else { //no errors: use parsed data
		if(treeoverwrite) notes.push('Tree data found in multiple files. Using '+Ttreesource);
		if(seqoverwrite) notes.push('Sequence data found in multiple files. Using '+Tseqsource);
		
		var feedback = function(){
   	  		if(options.dialog){
				$('.errors',options.dialog).text('Import complete.');
				if(options.mode == 'importcdna'){ //flip window back
					$("#importcdna").removeClass('finished flipped');
					setTimeout(function(){ $("#importcdna").addClass('finished') },900); //close window
				}
				else setTimeout(function(){ closewindow(options.dialog) }, 3000);
			}
			else if(options.importbtn){
				options.importbtn.text('Imported');
				setTimeout(function(){ closewindow(options.importbtn) }, 2000);
			}
   	  		if(notes.length){
				var ul = $('<ul class="wrap">');
				$.each(notes,function(j,note){ ul.append($('<li>').append(note)); });
				setTimeout(function(){ makewindow('File import warnings',['<br>',ul,'<br>'],{btn:'OK',icn:'info.png'}); }, 4000); 
			}
		};
		
		var namearr = [];
		if(typeof(Tsequences)=='object'){ //seq. data drop in
			$.each(Tsequences,function(name,seq){ if(~name.indexOf('_')){ //make spaces in names
				Tsequences[name.replace(/_/g,' ')] = seq;
				delete Tsequences[name]; 
			}});
			if(options.mode=='importcdna'){ model.dnasource(Tsequences); feedback(); return true; }
			sequences = Tsequences; Tsequences = '';
			namearr = Object.keys(sequences);
		}
		else sequences = {};
		
		treesvg = leafnodes = {}; //clear current data
		model.undostack.removeAll();
		model.treebackup = '';
		model.treesource('');
		model.treealtered(false);
		model.noanc(false);
		model.dnasource('');
		librarymodel.openid('');
		
		dom.wrap.css('left',0); dom.seq.css('margin-top',0); dom.treewrap.css('top',0); //reset scroll
		
		if(!Ttreedata && namearr.length){ //no tree: fill placeholders (otherwise done by jsPhyloSVG)
			Ttreesource = false;
			var nodecount = 0, leafcount = namearr.length, visrows = [];
			$.each(namearr,function(indx,arrname){
				leafnodes[arrname] = {name:arrname};
				if(nodeinfo[arrname]) leafnodes[arrname].ensinfo = nodeinfo[arrname];
				visrows.push(arrname); 
			});
			model.visiblerows(visrows);
		} else if(Ttreedata){ //get leaf count estimate
			var nodecount = Ttreedata.phyloxml? $(Ttreedata.phyloxml).find("clade").length : Ttreedata.newick.match(/\(/g).length;
			var leafcount = Ttreedata.phyloxml? $(Ttreedata.phyloxml).find("name").length : Ttreedata.newick.match(/,/g).length+1;
		}
		
		if(Ttreedata){ //tree data drop in
	  		model.treesource(Ttreesource); model.leafcount(leafcount); //leafcount > tree canvas height
	  		if(!$.isEmptyObject(nodeinfo)) Ttreedata.nodeinfo = nodeinfo;
	  		if(Tsequences=='phyloxml'){ idnames= {}; sequences = {}; } //sequence data will come from phyloxml
	  		else idnames = Tidnames;
	  		if(!$.isEmptyObject(treesvg)){ //replace current tree
	  			if(Tseqsource) Ttreedata.treeonly = true; //new sequence data: skip sequence redrawing step (do it after seq. processing)
	  			treesvg.loaddata(Ttreedata); //loads treedata
	  		}
	  		else if(Tsequences=='phyloxml') redraw(Ttreedata); //Make tree canvas. Get sequence data from phyloxml
	  	} else treesvg = {};
		
		var newcolors = false;
	  	if(Tseqsource){ //process new sequence data
	  		if(Tsequences=='phyloxml') namearr = Object.keys(sequences);
			var maxseqlen = 0, minseqlen = sequences[namearr[0]].length, totallen = 0;
			var longestseq = '', hasdot = false, alignlen = 0, tmpseq, seqlen;
			for(var n=0;n<namearr.length;n++){ //count sequence lengths
				tmpseq = sequences[namearr[n]].join('');
				if(!hasdot && ~tmpseq.indexOf('.')) hasdot = true;
				if(tmpseq.length > alignlen) alignlen = tmpseq.length;
				tmpseq = tmpseq.replace(/[-_.:]/g,''); seqlen = tmpseq.length; totallen += seqlen;
   				if(seqlen > maxseqlen){ maxseqlen = seqlen; longestseq = tmpseq; }
	   			if(seqlen < minseqlen){ minseqlen = seqlen; }
			}
			var dnachars = new RegExp('['+alphabet.dna.join('')+'U?!'+']','ig');
			var trimseq = longestseq.replace(dnachars,''); //check if a sequence is (mostly) DNA
			var oldtype = model.seqtype();
			var newtype = trimseq.length<longestseq.length*0.2? 'dna' : 'protein';
			if(newtype=='dna'){
				if(~longestseq.search(/U/i)) newtype = 'rna';
				model.dnasource(sequences);
			}
			model.seqtype(newtype); model.hasdot(hasdot);
			if(newtype!=oldtype){ newcolors = true; makeColors(); }
			
			model.totalseqlen(totallen); model.alignlen(alignlen); model.seqcount(namearr.length);
			model.minseqlen(minseqlen); model.maxseqlen(maxseqlen); idnames = Tidnames;
			model.seqsource(Tseqsource); maskedcols = [];
			if(visiblecols.length) model.visiblecols(visiblecols);
			else{
				for(var c=model.alignlen(), colarr=[]; c--;) colarr[c] = c;
				model.visiblecols(colarr); //mark all columns visible
			}
	  	}
	  	model.ensinfo(ensinfo);
	  	
   	  	if($.isEmptyObject(treesvg)||newcolors||Ttreedata.treeonly){ //load tree + render data
   	  		Ttreedata.treeonly = false;
   	  		redraw(Ttreedata||'');
   	  	}
   	  	if(treesvg.data){
   	  		if(Tseqsource && treesvg.data.root.children.length<3) model.noanc(true);
   	  		model.treebackup = treesvg.data.root.removeAnc().write('tags');
   	  	}
   	  		
   	  	
   	  	if(!$.isEmptyObject(treesvg) && !$.isEmptyObject(sequences)){ //check tree<=>seq data match
   	  		var emptyleaves = [];
   	  		$.each(leafnodes,function(name,node){
   	  			if(!sequences[name]){ emptyleaves.push(name); node.active = true; }
   	  			else node.active = false;
   	  		});
   	  		if(emptyleaves.length){
   	  			var leafsnote = emptyleaves.length+' out of '+Object.keys(leafnodes).length+' tree leafs do not match sequence data';
   	  			leafsnote += emptyleaves.length<5? ':<br>'+emptyleaves.join(', ') : '.';
   	  			var clearbtn = $('<a class="button square small">Clear sequences</a>');
   	  			clearbtn.click(function(){
   	  				librarymodel.openid(''); sequences = {}; redraw(); 
   	  				closewindow(this);
   	  			});
   	  			var prunebtn = $('<a class="button square small">Prune empty leafs</a>');
   	  			prunebtn.click(function(){
   	  				toolsmodel.processLeafs('remove',emptyleaves.length); 
   	  				closewindow(this);
   	  			});
   	  			leafsnote = $('<span>'+leafsnote+'<br><br></span>').append(clearbtn);
   	  			if(Object.keys(leafnodes).length-emptyleaves.length>3) leafsnote.append(prunebtn);
   	  			notes.push(leafsnote);
   	  		}
   	  	}
   	  	
   	  	if(options.source){
   	  		var src = options.source;
   	  		var sourcetype = src=='localread'||src=='upload'? 'local computer' : ~src.indexOf('import')? 'analysis library' : src=='download'? options.importurl? 'web address' : 'text input' : options.source;
   	  		model.sourcetype(sourcetype);
   	  	}
   	  	librarymodel.importurl = options.importurl||filenames.join(',')||'';
   	  	
   	  	if(options.id && !options.share){ //library item imported. save import date to server.
			librarymodel.openid(options.id); model.unsaved(false);
			exportmodel.savename(librarymodel.getitem(options.id).name());
        	setTimeout(function(){ communicate('writemeta',{id:options.id,key:'imported'}) }, 3000);
        } else {
        	model.unsaved(true);
        	var filename = filenames.length? filenames[0].split('.')[0].replace(/_/g,' ') : '';
        	exportmodel.savename(options.share||filename||'Untitled analysis');
        }
   	  	serverdata.import = {};
   	  	
   	  	model.refreshundo();
   	  	feedback(); //show 'imported'
   	  	return true;
   	  }//no errors => import data
}//parseimport()

/* Output file parsing */
function parseexport(filetype,options){
	var usemodel = false;
	if(!filetype && !options){ //use saved form input from export window
		usemodel = true;
		exportmodel.fileurl('');
		filetype = exportmodel.format().name;
		options = {};
		options.tags = exportmodel.variant().name && (exportmodel.variant().name=='extended newick');
		$.each(['masksymbol','includetree','includeanc','includehidden','trunc','truncsymbol','trunclen'], function(i,opt){
			options[opt] = exportmodel[opt]();
		});
	} else if(!options) var options = {};
	var nameids = options.nameids||{};
	var output = '', ids = [], regexstr = '', dict = {}, seqtype = model.seqtype();
	
	if(options.masksymbol && options.masksymbol!='lowercase'){ $.each(alphabet[seqtype],function(i,symbol){ //translation for masked positions
		if(seqtype=='codons') symbol = i;
		if(symbols[symbol].masked) dict[symbols[symbol].masked] = options.masksymbol;
	});}
	dict['!'] = '?'; dict['='] = '*';
	if(!options.gapsymbol) options.gapsymbol = '-';
	$.each(['-','_','.',':'],function(i,symbol){ dict[symbol] = options.gapsymbol; });
	$.each(dict,function(symbol){ regexstr += symbol; });
	var regex = regexstr ? new RegExp('['+regexstr+']','g') : '';
	var translate = regexstr ? function(s){ return dict[s] || s; } : '';
	
	var leafnames = [];
	$.each(leafnodes,function(leafname,obj){ if(obj.type!='ancestral') leafnames.push(leafname) });
	var names = options.includeanc? Object.keys(sequences) : leafnames;
	var specount = names.length, ntcount = model.alignlen();
	
	var parsename = function(name){
		if(filetype=='HSAML') return '';
		var pat = {'space':'\\s','digit':'\\d'};
		var exp = new RegExp(options.truncsymbol?(pat[options.truncsymbol]||'[^A-Za-z0-9 ]'):'');
		var ind = name.match(exp); ind = ind? ind.index : 0;
		var maxlen = parseInt(options.trunclen) || 0;
		var len = ind && (!maxlen||ind<maxlen)? ind : maxlen;
		return len? name.substring(0,len) : name;
	};
	
	if(options.makeids||filetype=='HSAML'||options.trunc){ //process names
		var seqi=0, parenti=0, tempid='', truncname='';
		$.each(names,function(j,name){
			if(options.trunc) truncname = parsename(name);
			if(~leafnames.indexOf(name)){ seqi++; tempid = truncname || 'sequence'+seqi; }
			else { parenti++; tempid = truncname || 'parent'+parenti; }
			nameids[name] = tempid;
		});
	}
	
	if((filetype=='newick'||options.includetree) && treesvg.data){
		var treefile = treesvg.data.root.write(options.tags,!Boolean(options.includeanc),nameids); 
	} else var treefile = '';
	
	var visiblecols = model.visiblecols();
	var parseseq = function(seqarr){
		var seqstr = '';
		if(options.removehidden && !options.includehidden){ $.each(visiblecols,function(i,pos){ if(pos==seqarr.length){ return false; } seqstr += seqarr[pos]; }); }
		else seqstr = seqarr.join('');
		return seqstr.replace(regex,translate);
	};
	
	var seqline = '';
	if(filetype=='fasta'){
		$.each(names,function(j,name){
			output += '>'+(nameids[name]||name)+"\n";
			seqline = parseseq(sequences[name]);
			for(var c=0;c<seqline.length;c+=50){ output += seqline.substr(c,50)+"\n"; }
		});
	}
	else if (filetype=='HSAML'){
  		output = "<ms_alignment>\n";
  		if(treefile) output += "<newick>\n"+treefile+"</newick>\n";
		
		output += "<nodes>\n"; var isleaf;
  		$.each(names,function(j,name){
  			isleaf = ~leafnames.indexOf(name);
  			seqline = parseseq(sequences[name]);
    		var xmlnode = isleaf? "\t<leaf " : "\t<node ";
    		xmlnode += "id=\""+(nameids[name]||name)+"\" name=\""+name+"\">\n\t\t<sequence>\n\t\t"+seqline+"\n\t\t</sequence>\n"+(isleaf?"\t</leaf>\n":"\t</node>\n");
    		output += xmlnode;
  		});
  		output += "</nodes>\n";
		output += "</ms_alignment>";
	}
	else if(filetype=='phylip'){
		output = specount+" "+ntcount+"\n";
		$.each(names,function(j,name){
			seqline = parseseq(sequences[name]);
			output += seqline+"\n";	
		});
	}
	else if(filetype=='newick'){ output = treefile; }
	
	if(usemodel||options.exportdata){ //export data to exportwindow & make download url
		if(options.exportdata){
			output = options.exportdata;
			filename = 'exported_subtree.nwk';
			exportmodel.filename(filename);
		} else filename = exportmodel.filename()+exportmodel.fileext();
		$('#exportedwindow .paper').text(output);
		$('#exportwrap').addClass('flipped');
		communicate('makefile',{filename:filename,filedata:output},{saveto:exportmodel.fileurl});
	}
	else if(options.exporturl){ //export server file to exportwindow
		$.get(options.exporturl,function(txt){$('#exportedwindow .paper').text(txt)},'text');
		$('#exportwrap').addClass('flipped');
		exportmodel.fileurl(options.exporturl);
		exportmodel.filename(parseurl(options.exporturl).file||'file.txt');
	}
	if(options.makeids) output = {file:output, nameids:nameids};
	return output;
}

//Save current MSA data to local server (library)
function savefile(btn){
	if(!$.isEmptyObject(sequences) || !$.isEmptyObject(treesvg)){
		var filedata = parseexport('HSAML',{includetree:true,includeanc:true,tags:true});
		var nodeinfo = {};
		$.each(leafnodes,function(name,node){ if(node.ensinfo&&node.type!='ancestral') nodeinfo[name] = node.ensinfo; });
		if($.isEmptyObject(nodeinfo)) nodeinfo = '';
		var visiblecols = model.hiddenlen()? model.visiblecols() : '';
		var ensinfo = $.isEmptyObject(model.ensinfo())? '' : model.ensinfo();
		communicate('save', {writemode:exportmodel.savetarget().type, file:filedata, name:exportmodel.savename(), source:model.sourcetype(), parameters:librarymodel.importurl,
			parentid:librarymodel.openparent(), id:librarymodel.openid(), ensinfo:ensinfo, nodeinfo:nodeinfo, visiblecols:visiblecols}, {btn:btn});
	}
	if($("#save").length) setTimeout(function(){ closewindow('save'); }, 2000);
	return false;
}

/* Rendrering: tree & sequence alignment areas */
function makeColors(){
	colors = [];
	if(!settingsmodel) return;
	var colorscheme = settingsmodel.colorscheme(), seqtype = model.seqtype();
	if(colorscheme!='rainbow' && colorscheme!='greyscale'){
		if(colorscheme=='nucleotides'){
			colors = {A:['','rgb(0,0,255)'], T:['','rgb(255, 255, 0)'], G:['','rgb(0, 255, 0)'], C:['','rgb(255, 0, 0)'], U:['','rgb(255, 255, 0)']};
		}
		else if(colorscheme=='Taylor'){
   			colors = { "A":["","rgb(204, 255, 0)"], "R":["","rgb(0, 0, 255)"], "N":["","rgb(204, 0, 255)"], "D":["","rgb(255, 0, 0)"], "C":["","rgb(255, 255, 0)"], "Q":["","rgb(255, 0, 204)"], "E":["","rgb(255, 0, 102)"], "G":["","rgb(255, 153, 0)"], "H":["","rgb(0, 102, 255)"], "I":["","rgb(102, 255, 0)"], "L":["","rgb(51, 255, 0)"], "K":["","rgb(102, 0, 255)"], "M":["","rgb(0, 255, 0)"], "F":["","rgb(0, 255, 102)"], "P":["","rgb(255, 204, 0)"], "S":["","rgb(255, 51, 0)"], "T":["","rgb(255, 102, 0)"], "W":["","rgb(0, 204, 255)"], "Y":["","rgb(0, 255, 204)"], "V":["","rgb(153, 255, 0)"], "B":["","rgb(255, 255, 255)"], "Z":["","rgb(255, 255, 255)"], "X":["","rgb(255, 255, 255)"]};
   		}
   		else if(colorscheme=='Clustal'){
   			colors = {A:['','rgb(128,160,240)'], R:['','rgb(240,21,5)'], N:['','rgb(0,255,0)'], D:['','rgb(192,72,192)'], C:['','rgb(240,128,128)'], Q:['','rgb(0,255,0)'], E:['','rgb(192,72,192)'], G:['','rgb(240,144,72)'], H:['','rgb(21,164,164)'], I:['','rgb(128,160,240)'], L:['','rgb(128,160,240)'], K:['','rgb(240,21,5)'], M:['','rgb(128,160,240)'], F:['','rgb(128,160,240)'], P:['','rgb(255,255,0)'], S:['','rgb(0,255,0)'], T:['','rgb(0,255,0)'], W:['','rgb(128,160,240)'], Y:['','rgb(21,164,164)'], V:['','rgb(128,160,240)'], B:['','rgb(255,255,255)'], X:['','rgb(255,255,255)'], Z:['','rgb(255,255,255)']};
   		}
   		else if(colorscheme=='Zappo'){
   			colors = {A:['','rgb(255,175,175)'], R:['','rgb(100,100,255)'], N:['','rgb(0,255,0)'], D:['','rgb(255,0,0)'], C:['','rgb(255,255,0)'], Q:['','rgb(0,255,0)'], E:['','rgb(255,0,0)'], G:['','rgb(255,0,255)'], H:['','rgb(100,100,255)'], I:['','rgb(255,175,175)'], L:['','rgb(255,175,175)'], K:['','rgb(100,100,255)'], M:['','rgb(255,175,175)'], F:['','rgb(255,200,0)'], P:['','rgb(255,0,255)'], S:['','rgb(0,255,0)'], T:['','rgb(0,255,0)'], W:['','rgb(255,200,0)'], Y:['','rgb(255,200,0)'], V:['','rgb(255,175,175)'], B:['','rgb(255,255,255)'], X:['','rgb(255,255,255)'], Z:['','rgb(255,255,255)']};
   		}
   		else if(colorscheme=='hydrophobicity'){
   			colors = {A:['','rgb(173,0,82)'], R:['','rgb(0,0,255)'], N:['','rgb(12,0,243)'], D:['','rgb(12,0,243)'], C:['','rgb(194,0,61)'], Q:['','rgb(12,0,243)'], E:['','rgb(12,0,243)'], G:['','rgb(106,0,149)'], H:['','rgb(21,0,234)'], I:['','rgb(255,0,0)'], L:['','rgb(234,0,21)'], K:['','rgb(0,0,255)'], M:['','rgb(176,0,79)'], F:['','rgb(203,0,52)'], P:['','rgb(70,0,185)'], S:['','rgb(94,0,161)'], T:['','rgb(97,0,158)'], W:['','rgb(91,0,164)'], Y:['','rgb(79,0,176)'], V:['','rgb(246,0,9)'], B:['','rgb(12,0,243)'], X:['','rgb(104,0,151)'], Z:['','rgb(12,0,243)']};
   		}
   	}
   	colors['-']=['#ccc',"rgb(255,255,255)"];colors['.']=['#e3e3e3',"rgb(255,255,255)"];colors['?']=['#f00',"rgb(255,255,255)"];
   	if(model.hasdot()) colors['-'][0] = "#999"; //darker del. symbol
   	//var symbolarr = seqtype=='codons'? Object.keys(alphabet.codons) : alphabet[seqtype];
   	for(var i=0;i<letters.length;i++){ //loop over ALL letters
   		var symbol = letters[i];
   		var unmasked = i%2==0 ? true : false;
   		if(colorscheme=='rainbow' || colorscheme=='greyscale'){ //generate all colors
   			var color = unmasked ? rainbow(letters.length,i,colorscheme) : mixcolors(rainbow(letters.length,i-1,colorscheme),[100,100,100]);
   			if(!colors[symbol]){ colors[symbol] = ["",color]; }
   		}
   		else{
   			if(!colors[symbol]){ //make missing color
   				if(unmasked){ colors[symbol] = ["","rgb(200,200,200)"]; } //symbols outside of colorscheme: grey bg
   				else{ colors[symbol] = ["",mixcolors(colors[letters[i-1]][1],[100,100,100])]; } //masked symbols: shade darker
   			}
   		}
   		var rgb = colors[symbol][1].match(/\d{1,3}/g); //adjust letter color for bg brightness
   		var brightness = Math.sqrt(rgb[0]*rgb[0]*.241 + rgb[1]*rgb[1]*.691 + rgb[2]*rgb[2]*.068);
   		var fgcolor = brightness<110 ? "#eee" : "#333";
   		if(!colors[symbol][0]){ colors[symbol][0] = fgcolor; }
   		
   		symbols[symbol] = { 'fgcolor' : colors[symbol][0], 'bgcolor' : colors[symbol][1] };
   		symbols[symbol].masked = unmasked ? letters[i+1] : symbol;
   		symbols[symbol].unmasked = unmasked ? symbol : letters[i-1];
   	} //Result: symbols = { A:{fgcolor:'#ccc',bgcolor:'#fff',masked:'a',unmasked:'A'}, a:{fgcolor,..}}
   	if(seqtype=='codons'){
   		$.each(alphabet.codons, function(codon,aa){
   			var maskaa = symbols[aa].masked, maskcodon = codon.toLowerCase();
   			symbols[codon] = symbols[aa]; symbols[maskcodon] = symbols[maskaa];
   			symbols[codon].masked = maskcodon; symbols[maskcodon].masked = codon;
   			symbols[codon].unmasked = codon; symbols[maskcodon].unmasked = maskcodon;
   		});
   		$.each(alphabet.gaps, function(i,gap){
   			var maskgap = symbols[gap].masked, codon = gap+gap+gap;
   			var maskcodon = maskgap+maskgap+maskgap;
   			symbols[codon] = symbols[gap];
   			symbols[codon].masked = maskcodon;
   			symbols[codon].unmasked = codon;
   		});	
   	}
   	makeCanvases();
}

//Note: a color palette: http://jsfiddle.net/k8NC2/1/ jalview color schemes
//Generates vibrant, evenly spaced colors. Adapted from blog.adamcole.ca
function rainbow(numOfSteps,step,colorscheme){
    var r, g, b;
    var h = step / numOfSteps;
    var i = ~~(h * 6);
    var f = h * 6 - i;
    var q = 1 - f;
    switch(i % 6){
        case 0: r = 1, g = f, b = 0; break;
        case 1: r = q, g = 1, b = 0; break;
        case 2: r = 0, g = 1, b = f; break;
        case 3: r = 0, g = q, b = 1; break;
        case 4: r = f, g = 0, b = 1; break;
        case 5: r = 1, g = 0, b = q; break;
    }
    if(colorscheme=='greyscale') r = g = b = (r+g+b)/3;
    return 'rgb('+parseInt(r*255)+','+parseInt(g*255)+','+parseInt(b*255)+')';
}

function mixcolors(color,mix){ //shade colors (masking)
	var rgb = color.match(/\d{1,3}/g);
	var r = Math.floor((parseInt(rgb[0])+mix[0])/2);
	var g = Math.floor((parseInt(rgb[1])+mix[1])/2);
	var b = Math.floor((parseInt(rgb[2])+mix[2])/2);
	return "rgb("+r+","+g+","+b+")";
}

//(re)render sequence & tree canvas
var zoomtimer = 0;
function redraw(options){
	if(!options) options = {};
	if(options.zoom){
		var zlevel = model.zoomlevel();
		if(options.zoom=='in' && zlevel<model.zlevels.length-1) model.zoomlevel(zlevel+1);
		else if(options.zoom=='out' && zlevel>0) model.zoomlevel(zlevel-1);
		else if(typeof(options.zoom)=='string') return false;
		clearTimeout(zoomtimer);
	}
	canvaslist = []; colflags = []; rowflags = []; model.activeid(''); //clear selections and its flags
	$("#seq div[id*='selection'],#seq div[id*='cross']").remove();
	$label = $("#namelabel"); $labelspan = $("#namelabel span");
	
	
	if($.isEmptyObject(treesvg) && !options.zoom){ //no tree loaded (first load)
	  dom.tree.empty(); dom.names.empty(); dom.treewrap.css('top',0);
	  
	  if(options.phyloxml||options.newick){ //make tree SVG
		dom.tree.css('box-shadow','none');
		dom.treewrap.css('background-color','white');
		
		treesvg = new Smits.PhyloCanvas(options);
		var svg = $("#tree>svg,#names>svg");
		svg.mousedown(function(e){ //handle nodedrag on tree
			e.preventDefault();
			var draggedtag = e.target.tagName;
	  		if(draggedtag=='circle' || draggedtag=='tspan'){
	  			var nodeid = parseInt(e.target.getAttribute('nodeid'));
	  			var draggednode = treesvg.data.root.getById(nodeid);
	  			if(!draggednode) return;
	  			$("body").one('mouseup',function(){ $("body").unbind('mousemove'); });
	  			var startpos = {x:e.pageX,y:e.pageY}, dragmode = false, helper;
				$("body").mousemove(function(evt){
					var dx = evt.pageX-startpos.x, dy = evt.pageY-startpos.y;
	  				if(Math.sqrt(dx*dx+dy*dy)>7){
	  					if(!dragmode){
	  						helper = movenode('drag',draggednode,draggedtag);
	  						dragmode = true;
	  					}
	  					if(helper) helper.css({left:evt.pageX+15,top:evt.pageY});
	  				}
	  	}); } });
	  }
	  else { //no tree: make tree/leafname placeholders
	  	model.treesource(''); model.treebackup = ''; model.treealtered(false); model.noanc(false);
		dom.treewrap.css('background-color','transparent');
		$("#tree").css('box-shadow','-2px 0 2px #ccc inset');
		
		$.each(model.visiblerows(),function(n,name){
			var leafname = leafnodes[name].ensinfo? leafnodes[name].ensinfo.species : name;
			var nspan = $('<span style="height:'+model.boxh()+'px;font-size:'+model.fontsize()+'px">'+leafname+'</span>');
			
			var hovertimer;
			nspan.mouseenter(function(){ //show full leaf name on mouseover
				if(leafnodes[name].ensinfo) nspan.css('cursor','pointer');
				rowborder({y:n*model.boxh()},'keep'); //show row highlight
				hovertimer = setTimeout(function(){ //show hidden part of name
					var cssobj = {'font-size': model.fontsize()+'px', 'top': nspan.offset().top+'px', 'left': $("#right").position().left-16+'px'};
					$label.css(cssobj);
					$labelspan.css('margin-left',0-dom.names.innerWidth()+6+'px'); $labelspan.text(leafname);
					$label.fadeIn(100);
				},800);
			});
			nspan.mouseleave(function(){ 
				clearTimeout(hovertimer);
				$label.fadeOut(100); 
			});
			if(leafnodes[name].ensinfo){ //leaf menu for ensembl info (treeless import)
				var ens = leafnodes[name].ensinfo;
				leafnodes[name].displayname = ens.species;
				nspan.click(function(){
					var ensmenu = {};
					if(ens.taxaname) ensmenu['<span class="note">Taxa</span> '+ens.taxaname] = '';
    				if(ens.cladename&&ens.species) ensmenu['<span class="note">Gene</span> '+
    					'<a href="http://www.ensembl.org/'+ens.species.replace(' ','_')+
    					'/Gene/Summary?g='+ens.cladename+'" target="_blank" title="View in Ensembl">'+ens.cladename+'</a>'] = '';
    				if(ens.accession&&ens.species) ensmenu['<span class="note">Protein</span> '+
    					'<a href="http://www.ensembl.org/'+ens.species.replace(' ','_')+'/Transcript/ProteinSummary?p='+
    					ens.accession+'" target="_blank" title="View in Ensembl">'+ens.accession+'</a>'] = '';
    				setTimeout(function(){ tooltip('',ens.genetype,{clear:true, arrow:'top', data:ensmenu, 
    						target:{ x:$("#names").offset().left, y:nspan.offset().top, width:$("#names").width(), height:model.boxh()}, style:'black' }) },100);
				});
			}
			dom.names.append(nspan);
		});
	  }
	} //no treeSVG
   	
   	var newheight = model.visiblerows().length ? model.visiblerows().length*model.boxh() : model.leafcount()*model.boxh();
	if(model.boxw()<4){ dom.treewrap.addClass('minimal'); } else { dom.treewrap.removeClass('minimal'); }
	if(!options.zoom){ dom.treewrap.css('height',newheight); $("#names svg").css('font-size',model.fontsize()+'px'); }
	if(dom.treewrap.css('display')=='none') dom.treewrap.fadeIn();
   	
   	var renderseq = function(){ //draws sequence canvas
   		if(!$.isEmptyObject(sequences) && !options.treeonly){
			makeRuler(); makeColors(); makeImage();
		}
		else if($.isEmptyObject(sequences) && !options.zoom){ //no sequence data
			model.visiblecols.removeAll(); model.seqsource(''); model.dnasource('');
			$('#seq .tile').remove(); $('#ruler').empty();
		}
		//set up scrollbars
		if(!dom.seqwindow.data("contentWidth")) mCustomScrollbar();
		else{ $(window).trigger('resize'); }
   	};
   	
   	//calculate new sequence/tree canvas position
   	var makezoom = Boolean(options.zoom && !options.refresh);
   	var oldwidth = parseInt(dom.seq.css('width'))||1;
   	var seqw = dom.seqwindow.innerWidth();
	var newwidth = model.visiblecols().length*model.boxw();
   	var left = parseInt(dom.wrap.css('left'));
   	if(makezoom && !$.isEmptyObject(sequences)) left = Math.round(((newwidth/oldwidth)*(left-(seqw/2)))+(seqw/2));
	var top = parseInt(dom.seq.css('margin-top'));
	var oldheight = parseInt(dom.seq.css('height'))||1;
	var visibleHeight = $("#left").height();
	if(makezoom) top = Math.round(((newheight/oldheight)*(top-(visibleHeight/2)))+(visibleHeight/2));
	//check boundaries
	if(top<0 && newheight>visibleHeight && Math.abs(top)>newheight-visibleHeight) top = visibleHeight-newheight; //new bottom limit
	if(top>0||newheight<visibleHeight) top = 0; //stick to top
	if(Math.abs(left)>newwidth-seqw) left = seqw-newwidth;
	if(left>0) left = 0;
	//reposition and render sequence canvas
	if(options.zoom && !options.refresh){ //keep currently visible sequence in center of viewport after zoom
		if(!$.isEmptyObject(sequences)){
			dom.seq.animate({opacity:0}, {duration:200, complete: function(){
				dom.seq.empty().append('<div id="rborder" class="rowborder">');
				dom.seq.css({'width':newwidth, 'height':newheight, 'margin-top':top, opacity:1});
				dom.wrap.css('left',left);
			}});
			$("#spinner").addClass('show');
		}
		
		dom.treewrap.animate({height:newheight, top:top},
			{duration:400, complete: function(){ zoomtimer = setTimeout(function(){ renderseq(); }, 600);}
		});
		if(!$.isEmptyObject(treesvg)) $("#names svg").css('font-size',model.fontsize()+'px');
		else $("#names span").css({height:model.boxh(),'font-size':model.fontsize()+'px'});
	}
	else { //keep current sequence position after rerender
		dom.seq.empty().append('<div id="rborder" class="rowborder">'); 
		dom.seq.css({width:newwidth, height:newheight});
		dom.seq.css('margin-top', top);
		dom.treewrap.css('top',top);
		dom.wrap.css('left', left);
		renderseq();
	}
}

function refresh(e){ //redraw tree => sequence
	if(e){ e.stopPropagation(); $('html').click(); } //hide tooltips
	if(treesvg.refresh) treesvg.refresh();
};

function cloneCanvas(oldCanvas){ //make a copy of a canvas element
	var newCanvas = document.createElement('canvas');
	if(!oldCanvas) return newCanvas;
	newCanvas.width = oldCanvas.width;
	newCanvas.height = oldCanvas.height;
    var context = newCanvas.getContext('2d');
	context.drawImage(oldCanvas,0,0);
	return newCanvas;
}

function makeCanvases(){ //make canvases for sequence letters
	var x = 0, y = 0, w = model.boxw(), h = model.boxh(), r = parseInt(w/5), fontzise = model.fontsize();
	if(w>1 && settingsmodel.boxborder()=='border'){ x++; y++; w--; h--; }
	$.each(symbols,function(symbol,data){
		var tmpel = document.createElement('canvas');
		tmpel.width = model.boxw();
		tmpel.height = model.boxh();
		var tmpcanv = tmpel.getContext('2d');
		tmpcanv.fillStyle = data.bgcolor;
		tmpcanv.fillRect(x,y,w,h);
		
		if(fontzise > 7){ //draw characters
			tmpcanv.font = fontzise+'px '+settingsmodel.font();
			tmpcanv.textAlign = 'center';
			tmpcanv.textBaseline = 'middle';
			tmpcanv.fillStyle = data.fgcolor;
			if(fontzise > 12){ //font shadow
			  if(data.fgcolor=="#eee"){
				tmpcanv.shadowColor = "#111";
				tmpcanv.shadowOffsetX = 0;
				tmpcanv.shadowOffsetY = 1.5;
				tmpcanv.shadowBlur = 1;
			  }
			  else if(data.fgcolor=="#333"){
				tmpcanv.shadowColor = "#fff";
				tmpcanv.shadowOffsetX = 0;
				tmpcanv.shadowOffsetY = -1;
				tmpcanv.shadowBlur = 1.5;
			  }
			}
			var l, symbolarr = symbol.split('');
			var colw = w/(symbolarr.length+1);
			$.each(symbolarr,function(i,letter){
				if(canvassymbols[letter]) letter = canvassymbols[letter];
				tmpcanv.fillText(letter, colw*(i+1)+x, (h/2)+y);
			});
		}
		symbols[symbol]['canvas'] = tmpel;
	});
	//$.each(symbols,function(i,data){$('#top').append(' ',data.canvas)}); //Debug
}

// render sequence tiles
function makeImage(target,cleanup,slowfade){
	//var d = new Date(), starttime = d.getTime();
	var targetx, targety, boxw = model.boxw(), boxh = model.boxh(), tilesize = {w:4000,h:2000};
	var colstep = parseInt(tilesize.w/boxw), rowstep = parseInt(tilesize.h/boxh); //tile size limits
	var visiblecols = model.visiblecols(), visiblerows = model.visiblerows();
	var fadespeed = slowfade? 400 : 100;
	if(target){
		var tarr = target.split(':');
		if(tarr[0]=='x'){ targetx = parseInt(tarr[1]); } else if(tarr[0]=='y'){ targety = parseInt(tarr[1]); }
	}
	if(!targetx){ if(!$("#wrap").position()) return; targetx = $("#wrap").position().left; }
	if(!targety){ targety = parseInt(dom.seq.css('margin-top')); }
	
	var colstartpix = parseInt((0-targetx)/boxw);
	var colstart = colstartpix-(colstartpix%colstep); //snap to (colstep-paced) tile grid
	var colend = parseInt((dom.seqwindow.innerWidth()-targetx)/boxw);
	if(colend>visiblecols.length) colend = visiblecols.length;
	
	var rowstartpix = parseInt((0-targety)/boxh);
	var rowstart = rowstartpix-(rowstartpix%rowstep); //snap to tile grid
	var rowend = parseInt(((dom.seqwindow.innerHeight()-$("#ruler").outerHeight())-targety)/boxh);
	if(rowend>visiblerows.length){ rowend = visiblerows.length; }
	
	if($('#seqtool').length) toolsmodel.hidelimit.valueHasMutated(); //seqtool window => update column preview
	var renderstart = 10, curcanvas = 0, lastcanvas = 0;
	var oldcanvases = $("#seq div.tile");
	for(var row = rowstart; row<rowend; row+=rowstep){ //loop over canvas grid
	  for(var col = colstart; col<colend; col+=colstep){
		if(canvaslist.indexOf(row+'|'+col)==-1){ //canvas not yet made
			if(curcanvas==0 && (rowend-rowstart)*(colend-colstart)>100000) $("#spinner").addClass('show'); //lots of sequence - show spinner
			canvaslist.push(row+'|'+col);
			lastcanvas++;
			
			setTimeout(function(r,c){ return function(){
				var canvasrow = r;
				var rstep = r+rowstep>visiblerows.length? visiblerows.length-r : rowstep;
				var cstep = c+colstep>visiblecols.length? visiblecols.length-c : colstep;
				var endrow = r+rstep;
				var endcol = c+cstep;
				var canvas = document.createElement('canvas');
				var tilediv = $('<div class="tile">');
				canvas.width = cstep*boxw;
				canvas.height = rstep*boxh;
				canvas.setAttribute('id', r+'|'+c);
				var canv = canvas.getContext('2d');		
				canv.fillStyle = 'white';
				canv.fillRect(0,0,canvas.width,canvas.height);
				
				while(canvasrow < endrow){ //draw rows of sequence to the tile
					var seqname = visiblerows[canvasrow], rowpx = (canvasrow - r)*boxh;
					if(!sequences[seqname]){ canvasrow++; continue; } //no sequence data: skip row
					for(var canvascol = c; canvascol<endcol; canvascol++){
						seqletter = sequences[seqname][visiblecols[canvascol]];
						if(!seqletter) continue; else if(!symbols[seqletter]) symbols[seqletter] = symbols['?'];
						canv.drawImage(symbols[seqletter]['canvas'], (canvascol - c)*boxw, rowpx); //draw the letter
					}
					canvasrow++;
				}
			
				tilediv.css({'left': c*boxw+'px', 'top': r*boxh+'px'});
				tilediv.append(canvas);
				dom.seq.append(tilediv);
				//d = new Date(); console.log((r-endrow)*(c-endcol)+'bp drawn on 'cstep*boxw+'*'+rstep*boxh+'px canvas: '+(d.getTime()-starttime)+'ms');
				tilediv.fadeIn(fadespeed);
				curcanvas++;
				if(curcanvas==lastcanvas){ //last tile made => cleanup
					$("#spinner").removeClass('show');
					setTimeout(function(){ //remove obsolete tiles
						if(cleanup){ oldcanvases.remove(); }
					},1000);
				}
			}}(row,col),renderstart);
			renderstart += 500; //time tile renderings
			
		}//make canvas	
	  }//for cols
	}//for rows
}

// make seqeuence area ruler bar
function makeRuler(){
	var $ruler = $("#ruler");
	$ruler.empty();
	var tick = 10, boxw = model.boxw(), tickw = tick*boxw-4, k = '', visiblecols = model.visiblecols();
	var markerdiv = function(scol,ecol){ //func. to make markers for hidden columns
		var gapindex = scol==0 ? 0 : visiblecols.indexOf(scol-1)+1;
		var l = gapindex*boxw-8;
		var colspan = ecol-scol;
		var sclass = colspan==1? 'small': colspan>5? 'big' : '';
		var div = $('<div class="marker '+sclass+'" style="left:'+l+'px">&#x25BC<div>|</div></div>');
		div.mouseenter(function(e){ tooltip(e,'Click to reveal '+colspan+' hidden column'+(colspan==1?'':'s')+'.',{target:div[0]}) });
		div.click(function(){ showcolumns([[scol,ecol]],'hidetip'); redraw(); });
		return div;
	}
	if(visiblecols[0]!==0) $ruler.append(markerdiv(0,visiblecols[0]));
	for(var t=0;t<visiblecols.length-1;t++){
		if((visiblecols[t+1]-visiblecols[t])!=1){ //a column gap => add marker
			if(visiblecols[t+1]<=visiblecols[t]){ //columns array corrupt. clean up array. redraw.
				visiblecols.sort(function(a,b){return a-b});
				for(var i=1;i<visiblecols.length;i++){ if(visiblecols[i-1]==visiblecols[i]) visiblecols.splice(i,1); }
				redraw(); return;
			}
			$ruler.append(markerdiv(visiblecols[t]+1,visiblecols[t+1]));
		}
	  	if(t%tick==0){ //make ruler tickmarks
			k = t;
			if(t+tick>visiblecols.length) tickw = (visiblecols.length%tick)*boxw-4;
			if(boxw<4){ if(t%100==0){ if(t>=1000){ k = '<span>'+(t/1000)+'K</span>'; }else{ k = '<span>'+t+'</span>'; } }else{ k = '&nbsp;'; } }
			$ruler.append($('<span style="width:'+tickw+'px">'+k+'</span>'));
		}
	}
	if(visiblecols[visiblecols.length-1] != model.alignlen()-1) $ruler.append(markerdiv(visiblecols[visiblecols.length-1]+1,model.alignlen()));
}

//Create drag-drop 'move tree node' mode
function movenode(drag,movednode,movedtype){
	if(!movednode) return false;
	$("#left").addClass('dragmode');
	$("#namesborderDragline").addClass('dragmode');
	movednode.highlight(true);
	setTimeout(function(){ //explanation popup
		tooltip('','Move node: '+(drag?'drop node to':'click on')+' target branch or node.', {target:$("#left"), shiftx:5, shifty:-30, arrow:'bottom', autohide:6000});
	}, 400);
	if(drag){
		$("#right").addClass('dragmode');
		setTimeout(function(){
			tooltip('','Delete node: drop node here.', {target:$("#right"), shifty:-5, arrow:'bottom', autohide:6000});
		}, 400);
	  	if(movedtype=='circle'){ //add drag helper (node preview)
	  		var helper = $(movednode.makeCanvas()).attr('id','draggedtree');
	  	}
	  	else if(movedtype=='tspan'){
	  		var helper = $('<div id="draggedlabel">'+(movednode.displayname||movednode.name)+'</div>');
	  	}
	  	$("body").append(helper);
	}//drag
	
	var drawtimer = 0, maxscroll = ($("#seq").height()+10)-($("#left").innerHeight()+3);
	var vertdragger = $("#verticalDragger .dragger");
	var draggerscale = maxscroll/($("#verticalDragger").height()-vertdragger.height());
	function loop(rate){ //treescroll
		var scrollto = parseInt(dom.treewrap.css('top'))+rate;
		if(scrollto > 0) scrollto = 0; else if(Math.abs(scrollto) > maxscroll) scrollto = 0-maxscroll;
    	dom.treewrap.stop(1).animate({top:scrollto}, 1000, 'linear', function(){ loop(rate) });
    	dom.seq.stop(1).animate({marginTop: scrollto}, 1000, 'linear');
    	vertdragger.stop(1).animate({top: (0-scrollto)/draggerscale}, 1000, 'linear');
	}        
	function stop(){ $('#treewrap,#seq,#verticalDragger .dragger').stop(1); clearInterval(drawtimer); }
	$.each(['up','down'],function(i,dir){ //set up hoverable scrollbuttons
	  	var scrolldiv = $('<div class="treescroll '+dir+'" style="width:'+($("#right").offset().left-30)+'px">'+(dir=='up'?'\u25B2':'\u25BC')+'</div>');
	  	$("#page").append(scrolldiv);
	  	var baseline = scrolldiv.offset().top;
	  	scrolldiv.mouseenter(function(){ drawtimer = setInterval(function(){ makeImage() }, 2000) });
	  	scrolldiv.mousemove(function(event){
	  		var rate = dir=='up'? scrolldiv.outerHeight()-(event.pageY-baseline) : 0-(event.pageY-baseline);
	  		if(rate%2 != 0) loop(rate*10);
	  	});
	  	scrolldiv.mouseleave(function(){ stop() });
	});
	  	
	$("body").one('mouseup',function(evnt){ //mouse release
		var targettype = evnt.target.tagName;
	  	if(targettype=='circle'||targettype=='tspan'||(targettype=='line'&&$(evnt.target).attr('class')=='horizontal')){
	  		var targetid = parseInt(evnt.target.getAttribute('nodeid'));
	  		var targetnode = treesvg.data.root.getById(targetid);
	  		if(movednode && targetnode){ movednode.move(targetnode); refresh(); }
	  	}
	  	else if (drag && targettype=='DIV' && evnt.target.id=='treebin'){ if(movednode){ movednode.remove(); } refresh(); }
	  	movednode.highlight(false);
	  	$("#left,#right,#namesborderDragline").removeClass('dragmode');
	  	$("div.treescroll").remove(); stop();
	  	if(drag) helper.remove();
	  	$("#page").unbind('mousemove'); hidetooltip();
	 });
	 if(drag) return helper;
}

function treemenu(node){ //generate contents for tree node menu
	var hidemenu = node.parent?{'Hide this node':{icon:'hide', t:'Collapse node and its children', click:function(){node.hideToggle()}}}:{};
    	$.each(node.children,function(i,child){ //build child nodes hiding submenu
    	if (child.type == 'ancestral') return true; //skip anc.
    	var litxt = (child.hidden?'Show ':'Hide ')+(i==0?'upper ':'lower ')+' child';
    	hidemenu[litxt] = {icon:i==0?'upper':'lower', t:'(Un)collapse a child node', click:function(){child.hideToggle()}};
    	if(child.children.length && child.hidden){ //preview hidden children
    		var createpreview = function(){ //create treepreview on the fly
    			var preview = $('<span style="margin-left:5px" class="svgicon">'+svgicon('view')+'</span>');
    			preview.mouseenter(function(e){ tooltip(e,'',{target:preview[0], data:child.makeCanvas(), arrow:'left', style:'none', hoverhide:true}); });
    			return preview;
    		}
    		hidemenu[litxt]['add'] = createpreview;
    	}
    });
    hidemenu['Show subtree'] = {icon:'children', t:'Uncollapse all child nodes', click:function(){node.showSubtree()}};
    
    var menu = {'Show/hide tree nodes':{submenu:hidemenu}};
    var ancnode = node.children[node.children.length-2];
    if(ancnode.type=='ancestral'){ //ancestral nodes submenu
    	menu['Ancestral sequences'] = {submenu:{
    		'Show/hide ancestral seq.': {t:(ancnode.hidden?'Reveal':'Hide')+' the ancestral sequence of this node', icon:'ancestral', click:function(){ancnode.hideToggle()}},
    		'Show subtree ancestors': {t:'Show ancestral sequences of the whole subtree', icon:'ancestral', click:function(){node.showSubtree('anc')}},
    		'Hide subtree ancestors': {t:'Hide ancestral sequences of the whole subtree', icon:'ancestral', click:function(){node.showSubtree('anc','hide')}},
    	}};
    }
    menu['Reorder subtree'] = {submenu:{'Swap children':{t:'Swap places of child nodes', icon:'swap', click:function(){node.swap()}}}};
    if(node.visibleLeafCount>2) menu['Reorder subtree']['submenu']['Ladderise subtree'] = {t:'Reorder the subtree', icon:'ladderize', click:function(){node.ladderize()}};
    if(node.parent){
    	menu['Move node'] = {t:'Graft this node to another branch in the tree', icon:'move', click:function(){movenode('',node,'circle')}, noref:true};
    	menu['Place root here'] = {t:'Place this node as the tree outgroup', icon:'root', click:function(){node.reRoot()}};
    	menu['Remove nodes'] = {submenu:{'Remove this node': {t:'Remove this node and its children from the tree', icon:'trash', click:function(){node.remove()}}}};
    	if(node.leafCount>2) menu['Remove nodes']['submenu']['Keep only subtree'] = {t:'Remove all nodes except this subtree', icon:'prune', click:function(){node.prune()}};
    }	
    menu['Export subtree'] = {t:'Export this subtree in newick format', icon:'file_export', click:function(){dialog('export',{exportdata:node.write()})}, css:{'border-top':'1px solid #999'}, noref:true};
    return menu;
}

//make tooltips & pop-up menus
function tooltip(evt,title,options){
	if(!options) options = {};
	if(typeof(title)=='string') title = title.replace(/#/g,'');
	var tipdiv = options.id? $('#'+options.id) : [];
	if(tipdiv.length){ //use existing tooltip
		var tiparrow = $(".arrow",tipdiv);
		var tiptitle = $(".tooltiptitle",tipdiv);
		var tipcontentwrap = $(".tooltipcontentwrap",tipdiv);
		var tipcontent = $(".tooltipcontent",tipdiv);
		tiptitle.empty(); tipcontent.empty();
	} else { //generate new tooltip
		tipdiv = $('<div class="tooltip"></div>');
		var tiparrow = $('<div class="arrow"></div>');
		var tiptitle = $('<div class="tooltiptitle"></div>');
		var tipcontentwrap = $('<div class="tooltipcontentwrap"></div>');
		var tipcontent = $('<div class="tooltipcontent"></div>');
		tipcontentwrap.append(tipcontent);
		tipdiv.append(tiparrow,tiptitle,tipcontentwrap);
		if(options.id){
			if(options.id=='treemenu' && options.data){ tipdiv.remove(); return; }
			else tipdiv.attr('id',options.id);
		}
		var box = options.container || 'body';
		$(box).append(tipdiv);
	}
	if(!title) tiptitle.css('display','none');
	
	var node = false, titleadd = false;
	if(options.nodeid && treesvg.data){
    	node = treesvg.data.root.getById(options.nodeid);
    	activenode = options.nodeid;
    }
	
	if(options.clear) hidetooltip('',tipdiv,options.nodeid||'');
	$('html').off('click').one('click',function(){ hidetooltip('',tipdiv,options.nodeid||''); });
	
	var arr = options.arrow || false;
	var treetip = options.treetip||false;
	var tipstyle = options.style||settingsmodel.tooltipclass()||'none';
	if(tipstyle!='none') tipdiv.addClass(tipstyle); //custom style
	if(options.css) tipdiv.css(options.css);
	
	if(options.target){ //place next to target element
		var target = typeof(options.target)=='object'? options.target : evt.target;
		if(target.jquery) target = target[0];	
    	if(target.tagName){ //target is DOM element
    		var elem = $(target);
    		if(!target.width) target.width = elem.width();
    		if(!target.height) target.height = elem.height();
    		if(target.tagName.toLowerCase()=='circle'){ //target is treenode
    			if(options.nodeid) treetip = true;
    			target.x = elem.offset().left+25;
    			target.y = elem.offset().top-7;
    		}
    		else if(target.tagName.toLowerCase()=='li'){ //target is tooltip. place as submenu
    			target.x = elem.innerWidth()-2;
    			target.y = elem.position().top-2;
    			if(tipstyle=='white') target.y -= 1;
    		}
    		else{ //place tooltip next to element
    			target.x = elem.offset().left;
    			target.y = elem.offset().top;
    			if(elem.hasClass('svgicon')){ target.x += 27; target.y -= 3; }
    			if(!arr){
    				target.x += 15;
    				target.y += target.height+5;
    			}
    		}
    	}
    	else {
    		if(isNaN(target.x)) target.x = evt.pageX+5;
    		if(isNaN(target.y)) target.y = evt.pageY+5;
    		if(!target.height) target.height = 0;
    	}
    }
    else{ var target = { x: evt.pageX+5, y: evt.pageY+5 }; } //tooltip next to cursor
    target.x += parseInt(options.shiftx||0); target.y += parseInt(options.shifty||0);
    var rightedge = $('body').innerWidth()-200;
    if(!options.container && target.x > rightedge) target.x = rightedge;
    
    if(options.data){ //make pop-up menu
     	if(treetip && node){ //prepare tree node popup menu
      		//generate tree menu title
      		var name = node.displayname || node.name || 'no name';
      		var hiddencount = node.leafCount - node.visibleLeafCount;
    		var titleadd = $('<span class="right">'+(hiddencount?' <span class="svgicon" style="padding-right:0" title="Hidden leaves">'+svgicon('hide')+'</span>'+hiddencount : '')+'</span>');
    		if(hiddencount && name.length>10) titleadd.css({position:'relative',right:'0'});
    		var infoicon = $('<span class="svgicon">'+svgicon('info')+'</span>').css({cursor:'pointer'}); //info icon
    		infoicon.mouseenter(function(e){ //hover infoicon=>show info
    			var nodeinf = ['Branch length: '+(Math.round(node.len*1000)/1000),'Length from root: '+(Math.round(node.lenFromRoot*1000)/1000),'Levels from root: '+node.level];
    			if(hiddencount) nodeinf.unshift('Hidden leaves: '+hiddencount);
    			if(node.children.length) nodeinf.unshift('Visible leaves: '+node.visibleLeafCount);
    			if(node.confidence) nodeinf.push('Branch support: '+node.confidence);
    			if(node.events){ //gene evol. events (ensembl)
    				if(node.events.duplications) nodeinf.push('Duplications: '+node.events.duplications);
    				if(node.events.speciations) nodeinf.push('Speciations: '+node.events.speciations);
    			}
    			if(node.taxaid) nodeinf.push('Taxonomy ID: '+node.taxaid);
    			if(node.ec) nodeinf.push('EC number: '+node.ec);
    			tooltip(e,'',{target:infoicon[0],data:nodeinf,arrow:'left',style:'nomenu',hoverhide:true});
    		});
    		titleadd.append(infoicon);
    		if(!node.parent && !node.species) name = 'Root';
    		var desc = (node.parent?'':'Root node: ')+(node.species?'taxa ':'')+name;
    		title = '<span class="title" title="'+desc+'">'+name+'</span>';
    		options.data = treemenu(node); //generate tree menu
		}
      	//make pop-up menu
      	if(options.data.tagName){ tipcontent.append(options.data); } //tooltip of a DOM element (preview)
      	else{ //list-type menu
      		var ul = $('<ul>');
    		$.each(options.data,function(txt,obj){
    			var li = $('<li>');
	    		if(typeof(obj)=='object'){
	    			if(obj.txt) txt = obj.txt;
	    			var submenulist = obj.submenu? Object.keys(obj.submenu) : [];
    				if(submenulist.length>1){ //nested submenu
    					txt += ' <span class="right">\u25B8</span>';
    					li.addClass('arr');
    					li.mouseenter(function(evt){ tooltip(evt,'',{target:li[0], data:obj.submenu, style:options.style||'', treetip:treetip}) });
    					li.click(false); //disable click
	    			}
	    			else{
	    				if(submenulist.length){ //un-nest 1-item submenu
	    					txt = submenulist[0];
	    					obj = obj.submenu[txt];
	    				} else if(!obj.click) return true; //skip just labels
	    			}
	    			if(obj.icon) txt = '<span class="svgicon" '+(obj.t?'title="'+obj.t+'"':'')+'>'+svgicon(obj.icon)+'</span>'+txt;
	    			li.html(txt);
	    			if(typeof(obj.click)=='function'){
	    				li.click(obj.click);
	    				if(treetip && !obj.noref) li.click(refresh); //treemenu click followup
	    			}
    				if(obj.over) li.mouseenter(obj.over);
    				if(obj.out) li.mouseleave(obj.out);
    				if(obj.add) li.append(obj.add);
    				if(obj.css) li.css(obj.css);
    				if(obj.class) li.addClass(obj.class);
    			}
	    		else{
    				if(typeof(txt)=='number'){ li.html(obj) }
    				else{
    					li.html(txt);
    					if(typeof(obj)=='function') li.click(obj);
    				}
				}
				ul.append(li);
    		});
    		tipcontent.append(ul);
	    	if(title){
	    		tiptitle.html(title); $('li:first-child',ul).css('border-radius',0);
	    		if(titleadd) tiptitle.append(titleadd);
	    	}
	    	else{ tiptitle.css('display','none'); ul.css('border-top','none'); }
    		
    		if(treetip && title){ //treemenu slidedown
    			tipcontentwrap.css({'height':tipcontent.innerHeight()+2+'px'});
    			setTimeout(function(){tipcontentwrap.css('overflow','visible')},500); //unblock submenus
    		}
    		
    		if(target.tagName && target.tagName.toLowerCase() == 'li'){ //submenu
    			$(target).append(tipdiv);
		   		options.hoverhide = true;
    		}
    		else{ setTimeout(function(){ $('html').off('click').one('click',function(){hidetooltip()}); }, 400); }
		}
	}else{ //make simple tooltip
		if(treetip){
			if(!node.parent && !node.species) title = 'Root node';
			else title = node.displayname || node.name || 'no name';
		}
		tiptitle.empty().append(title);
		if(!options.nohide){ //self-hide
			if(typeof(options.target)!='object' || options.target.tagName){ options.hoverhide = true; } //DOM target
			setTimeout(function(){hidetooltip(tipdiv)}, options.autohide||3000); //remote target
		} 
	}
   if(options.hoverhide && target.tagName){ $(target).one('mouseleave',function(){ hidetooltip(tipdiv,'',activenode); }); } //DOM target; hide on mouseleave (e.g. submenu)
   if(arr=='top'||arr=='bottom'){ //adjust arrowed tooltip
   		target.x += (target.width-tipdiv.innerWidth())/2;
   		if(arr=='top' && target.y+tipdiv.innerHeight()+20>$('#page').innerHeight()) arr = 'bottom';
   		if(arr=='top') target.y += target.height+15;
   		else if(arr=='bottom') target.y -= tipdiv.innerHeight()+10;
   }
   if(arr) tipdiv.addClass(arr+'arrow');
   if(!options.nomove) tipdiv.css({left:parseInt(target.x),top:parseInt(target.y)});
   setTimeout(function(){tipdiv.addClass('opaque')},34);
   return tipdiv;
}

var activenode = ''; //id of selected treenode
function hidetooltip(include,exclude,nodeid){
	if(activenode && (!nodeid || activenode!=nodeid)){
		try{ treesvg.data.root.getById(activenode).highlight(false); }catch(e){}
		activenode = '';
	}
	if(!include) model.activeid('');
	var tooltips = $(include||"div.tooltip").not(exclude);
	tooltips.each(function(){
		var tip = $(this);
		tip.removeClass('opaque');
		setTimeout(function(){ tip.remove(); },200);
	});
}

function selectionsize(e,id,type){ //make or resize a sequence selection box
	if(typeof(type)=='undefined'){ var type = 'rb', start = {}; }
	else if(typeof(type)=='object'){ //type => mouse startpos{x,y} || columns [start,end]
		var start = type.length? {x:type[0]*model.boxw(),w:type[1]-type[0]} : type.x&&type.y? {x:type.x,y:type.y} : {x:0,y:0};
		if(type.length && (type[1]*model.boxw()<Math.abs(dom.wrap.position().left) || type[0]*model.boxw()>Math.abs(dom.wrap.position().left)+dom.seqwindow.innerWidth())) return; //outside of seqwindow
		if(e){
			var dx = e.pageX-type.x, dy = e.pageY-type.y;
			if(dx<10||dy<10) return; else type = 'rb';
		}
	}
	id = id || model.activeid();
	if(!id){ //create new selectionbox
		id = $("div[id^='selection']").length+1;
		var x=0, y=0, w=1, h=1;
		dom.seq.append('<div id="selection'+id+'" class="selection"><div class="description"></div><div class="ltresize"></div><div class="rbresize"></div></div>\
			<div id="vertcross'+id+'" class="selectioncross"><div class="lresize"></div><div class="rresize"></div></div>\
			<div id="horicross'+id+'" class="selectioncross"><div class="tresize"></div><div class="bresize"></div></div>');
		if(typeof(type)=='object'){ //coordinates given
			x = start.x||x;
			y = start.y||model.boxh()*model.visiblerows().length-model.boxh();
			w = start.w||w;
		}else{ //coordinates from mouse
			x = (start.x||e.pageX)-dom.seq.offset().left-2;
			y = (start.y||e.pageY)-dom.seq.offset().top;
			model.activeid(id);
		}
		x = x-(x%model.boxw()); y = y-(y%model.boxh()); //snap to grid
		if(x<0) x=0; if(y<0) y=0;
		$("#selection"+id).css({'left':x,'top':y,'width':model.boxw()*w,'height':model.boxh()*h,'display':'block'});
		$("#vertcross"+id).css({'left':x,'top':'0','width':model.boxw()*w,'height':dom.seq.innerHeight(),'display':model.selmode()=='columns'?'block':'none'});
		$("#horicross"+id).css({'left':'0','top':y,'width':dom.seq.innerWidth(),'height':model.boxh()*h,'display':model.selmode()=='rows'?'block':'none'});
		dom.seqwindow.mouseup(function(){ //attach resize handles
			$("#selection"+id).mouseenter(function(){ $("#selection"+id+" div.rbresize, #selection"+id+" div.ltresize").css('opacity','1'); });
			$("#selection"+id).mouseleave(function(){ $("#selection"+id+" div.rbresize, #selection"+id+" div.ltresize").css('opacity','0'); });
			$("#vertcross"+id).mouseenter(function(){ $("#vertcross"+id+" div.lresize, #vertcross"+id+" div.rresize").css('opacity','1'); });
			$("#vertcross"+id).mouseleave(function(){ $("#vertcross"+id+" div.lresize, #vertcross"+id+" div.rresize").css('opacity','0'); });
			$("#horicross"+id).mouseenter(function(){ $("#horicross"+id+" div.tresize, #horicross"+id+" div.bresize").css('opacity','1'); });
			$("#horicross"+id).mouseleave(function(){ $("#horicross"+id+" div.tresize, #horicross"+id+" div.bresize").css('opacity','0'); });
			$("#selection"+id+" div.rbresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'rb'); });
			});
			$("#selection"+id+" div.ltresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'lt'); });
			});
			$("#vertcross"+id+" div.rresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'r'); });
			});
			$("#vertcross"+id+" div.lresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'l'); });
			});
			$("#horicross"+id+" div.bresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'b'); });
			});
			$("#horicross"+id+" div.tresize").mousedown(function(){
				dom.seqwindow.mousemove(function(evt){ selectionsize(evt,id,'t'); });
			});
		});
	} else { //resize existing selection
		var over = e.target.id ? e.target : e.target.parentNode;
		if(over.tagName=='DIV'&&id!=over.id.substr(0-id.toString().length)){ return false; }//avoid overlap
		var seldiv = $("#selection"+id);
		if(!seldiv.length) return;
		if(type!='b'&&type!='t'){
			if(type=='r'||type=='rb'){
				var w = e.pageX-seldiv.offset().left-5;
				w = w-(w%model.boxw())+model.boxw();
			} else if(type=='l'||type=='lt'){
				var l = e.pageX-seldiv.parent().offset().left+5;
				l = l-(l%model.boxw());
				var redge = seldiv.position().left+seldiv.innerWidth();
				if(l>redge-model.boxw()){ l=redge-model.boxw(); }
				var w = redge-l;
				seldiv.css('left',l);
				$("#vertcross"+id).css('left',l);
			}
			if(w<model.boxw()){ w = model.boxw(); }
			seldiv.css('width',w);
			$("#vertcross"+id).css('width',w);
		}
		if(type!='r'&&type!='l'){
			if(type=='b'||type=='rb'){
				var h = e.pageY-seldiv.offset().top-5;
				h = h-(h%model.boxh())+model.boxh();
			} else if(type=='t'||type=='lt'){
				var t = e.pageY-seldiv.parent().offset().top+5;
				t = t-(t%model.boxh());
				var bedge = seldiv.position().top+seldiv.innerHeight();
				if(t>bedge-model.boxh()){ t=bedge-model.boxh(); }
				var h = bedge-t;
				seldiv.css('top',t);
				$("#horicross"+id).css('top',t);
			}
		 	if(h<model.boxh()){ h = model.boxh(); }
			seldiv.css('height',h);
			$("#horicross"+id).css('height',h);
		}
		if(seldiv.innerHeight()>20 && seldiv.innerWidth()>40){//show selection size
			if(seldiv.innerWidth()>140){ var r=' rows | ',c=' columns';}else{ var r='x',c=''; }
			$("#selection"+id+' div.description').css('display','block'); 
			$("#selection"+id+' div.description').text(parseInt(seldiv.innerHeight()/model.boxh())+r+parseInt(seldiv.innerWidth()/model.boxw())+c);
		} else { $("#selection"+id+' div.description').css('display','none'); }
	}
}

function registerselections(id){//set flags in seq. selection vectors
	colflags = []; rowflags=[]; selections = [];
	var selector = id ? '#selection'+id : 'div[id^="selection"]';
	$(selector).each(function(){
		var sel = $(this);
		var colstart = parseInt(sel.position().left/model.boxw());
		var colend = parseInt((sel.position().left + sel.width())/model.boxw());
		var rowstart = parseInt(sel.position().top/model.boxh());
		var rowend = parseInt((sel.position().top + sel.height())/model.boxh());
		for(var c=colstart;c<colend;c++){ colflags[c] = 1; }
		for(var r=rowstart;r<rowend;r++){ rowflags[r] = 1; }
		selections.push({'rowstart':rowstart,'rowend':rowend,'colstart':colstart,'colend':colend});
	});
}

function clearselection(id){
	id = typeof(id)=='undefined' ? false : id;
	if(id){ $("#selection"+id).remove(); $("#vertcross"+id).remove(); $("#horicross"+id).remove(); }
	else{ $("#seq div[id*='selection'],#seq div[id*='cross']").remove(); }
	model.activeid('');
}

function toggleselection(type,id,exclude){ //toggle row/column selection
	if(typeof(id)=='undefined') id=''; if(typeof(exclude)=='undefined') exclude='';
	if(~type.indexOf('tmp') && model.selmode()!='default') return;
	if(type=='default'){ toggleselection('hide rows',id); type='hide columns'; } //actions for selection mode change
	else if(type=='columns'){ toggleselection('hide rows',id); type='show columns'; }
	else if(type=='rows'){ toggleselection('show rows',id); type='hide columns'; }
	var divs = ~type.indexOf('rows')? $('div[id^="horicross'+id+'"]') : ~type.indexOf('columns')? $('div[id^="vertcross'+id+'"]') : $('div[id$="cross'+id+'"]');
	if(exclude) divs = divs.not('div[id$="cross'+exclude+'"]'); //filter out some divs
	$(divs).each(function(){ if(~type.indexOf('show')) $(this).stop().fadeIn(200); else $(this).fadeOut(200); }); 
}

function seqinfo(e){ //generate character info tooltip content
	if(!e.pageX||!e.pageY) return false;
	var x = e.pageX-dom.seq.offset().left-2;
	x = parseInt(x/model.boxw());
	var y = e.pageY-dom.seq.offset().top-2;
	y = parseInt(y/model.boxh());
	if(x<0){ x=0; } if(y<0){ y=0; }
	var col = model.visiblecols()[x]; var name = model.visiblerows()[y];
	if(!sequences[name]) return false;
	var suppl = col==x ? '' : '<br>(column '+(col+1)+' if uncollapsed)';
	var seqpos = sequences[name].slice(0,col+1).join('').replace(/[_\-.:]/g,'').length;
	var symb = typeof(sequences[name][col])=='undefined' ? '' : sequences[name][col];
	symb = canvaslabels[symb]||symb;
	var symbcanvas = model.boxh()>12 && typeof(symbols[symb])!='undefined'? cloneCanvas(symbols[symb]['canvas']) : '<span style="color:orange">'+symb+'</span>';
	if(leafnodes[name]) name = leafnodes[name].displayname||name;
	var content = $('<span style="color:orange">'+name+'</span><br>').add(symbcanvas).add('<span> position '+seqpos+' column '+(x+1)+suppl+'</span>');
	return {content:content, col:x, row:y, x:x*model.boxw(), y:y*model.boxh(), width:model.boxw(), height:model.boxh()}
}

function hidecolumns(e,id){ //make columns hidden (based on [selections =>]columnflags)
	if(e){ e.stopPropagation(); hidetooltip(); registerselections(id); }
	var undodata = [], range = [], col = 0;
	if((id && id=='noundo') || !settingsmodel.undo()) undodata = false;
	for(var c=0,adj=0;c<colflags.length;c++){
		if(undodata){
			col = model.visiblecols()[c-adj];
			if(colflags[c]){ if(!range.length) range[0] = col; }
			else if(range.length){ range[1] = col; undodata.push(range); range = []; } 
		}
		if(colflags[c]){ model.visiblecols.splice(c-adj,1); adj++; } //remove columns from rendering list
	}
	if(undodata){
		if(range.length){ range[1] = col+1; undodata.push(range); }
		if(undodata.length){
			var s = undodata.length==1? ' was' : 's were';
			var undodesc = undodata.length+' alignment column range'+s+' collapsed.';
			model.addundo({name:'Collapse columns',type:'seq',data:undodata,info:undodesc,
			undoaction:'show columns',redoaction:'hide columns'});
		}
	}
	redraw();
}

function showcolumns(gaparr,hidetip){ //make columns visible again (based on input ranges)
	if(hidetip) hidetooltip();
	if(gaparr=='all'){
		for(var c=model.alignlen(), colarr=[]; c--;) colarr[c] = c;
		model.visiblecols(colarr); //mark all columns as visible
		redraw(); return;
	}
	var visiblecols = model.visiblecols();
	$.each(gaparr, function(i,gapcols){
		if(gapcols.length!=2) return true;
		var scol = gapcols[0], ecol = gapcols[1], start = 0, del = 0, fill = [];
		$.each(visiblecols,function(i,c){ if(c>=scol){ //indexes to fill in
				if(i&&!start) start = i;
				if(c<ecol) del++; else return false;
		}});
		for(var f=scol;f<ecol;f++){ fill.push(f); }
		if(scol>=visiblecols.length) start = visiblecols.length;
		model.visiblecols.splice.apply(model.visiblecols,[start,del].concat(fill));
	});
}

function hiderows(e,id){ //hide seq. rows from seq. area
	if(e){ e.stopPropagation(); hidetooltip(); }
	var namearr = [];
	action = 'hide';
	registerselections(id);
	for(var r=0;r<rowflags.length;r++){ if(rowflags[r]){ namearr.push(model.visiblerows()[r]); }}
	$.each(namearr,function(n,name){ if(leafnodes[name]) leafnodes[name].hideToggle('hide'); });
	refresh();
}

function maskdata(e,action,id){ //mask a sequence region
	if(e){ e.stopPropagation(); hidetooltip(); }
	var target = ~action.indexOf('rows')? 'rows' : ~action.indexOf('columns')? 'columns' : 'selections';
	if(~action.indexOf('unmask')){ var symboltype = 'unmasked'; var flag = false; } else { var symboltype = 'masked'; var flag = 1; }
	registerselections(id);
	var undodata = {}, undodesc = '';
	
	if(~action.indexOf('all')){
		for(var name in sequences){ for(var c=0;c<sequences[name].length;c++) sequences[name][c] = symbols[sequences[name][c]][symboltype]; }
	}
	else if(action=='hidemaskedcols'){
		for(var c=0;c<maskedcols.length;c++){ 
			if(maskedcols[c]){
				var colind = model.visiblecols.indexOf(c);
				if(~colind){ model.visiblecols.splice(colind,1); }
			} 
		}
	}
	else if(target=='columns'){
		undodata._columns = []; var firstrow = true;
		for(var name in sequences){ if(~model.visiblerows.indexOf(name)){
			if(flag) undodata[name] = 'columns';
			for(var c=0;c<colflags.length;c++){ if(colflags[c]){
					var colid = model.visiblecols()[c];
					sequences[name][colid] = symbols[sequences[name][colid]][symboltype];
					maskedcols[colid] = flag;
					if(flag && firstrow) undodata._columns.push(colid);
			}}
			firstrow = false;
		}}
		undodesc = undodata._columns.length+' alignment columns were masked.';
	}
	else if(target=='rows'){
		for(var r=0;r<rowflags.length;r++){ if(rowflags[r]){
				var name = model.visiblerows()[r];
				if(flag) undodata[name] = 'all';
				for(var c=0;c<sequences[name].length;c++){ sequences[name][c] = symbols[sequences[name][c]][symboltype]; }
		}}
		undodesc = Object.keys(undodata).length+' sequences were masked.';
	}
	else if(target=='selections'){
		for(var s=0;s<selections.length;s++){
			var sel = selections[s];
			for(var r=sel.rowstart;r<sel.rowend;r++){
				var name = model.visiblerows()[r];
				if(!undodata[name]) undodata[name] = [];
				for(var c=sel.colstart;c<=sel.colend;c++){
					var colid = model.visiblecols()[c];
					sequences[name][colid] = symbols[sequences[name][colid]][symboltype];
					if(flag) undodata[name].push(colid);
					else maskedcols[colid] = false;
				}
			}
		}
		undodesc = selections.length+' alignment blocks were masked.';
	}
	if(!$.isEmptyObject(undodata)){
		model.addundo({name:'Mask '+target,type:'seq',data:undodata,info:undodesc,undoaction:'unmask',redoaction:'mask'});
	}
	redraw();
}

function undoseq(undodata,action){ //undo/redo sequence actions
	if(~action.indexOf('mask')){ //(un)mask seq. areas/rows/columns
		var symboltype = ~action.indexOf('unmask')? 'unmasked' : 'masked';
		var columns = undodata._columns? undodata._columns : [];
		for(name in undodata){
			if(!sequences[name]) continue;
			if(undodata[name]==='all'){
				for(var c=0;c<sequences[name].length;c++) sequences[name][c] = symbols[sequences[name][c]][symboltype];
			} else {
				if(undodata[name]!=='columns') columns = undodata[name];
				for(var c=0;c<columns.length;c++) sequences[name][columns[c]] = symbols[sequences[name][columns[c]]][symboltype];
			}
		}
	}
	else if(~action.indexOf('columns')){ //(un)hide seq. columns
		if(~action.indexOf('show')) showcolumns(undodata);
		else if(~action.indexOf('hide')){
			colflags = [];
			var c = 0, i = 0; visiblecols = model.visiblecols();
			$.each(undodata,function(i,range){
				if(range.length!=2) return true;
				var scol = range[0], ecol = range[1];
				for(;i<visiblecols.length;i++){ //column range=>colflags
					c = visiblecols[i];
					if(c>=scol){ if(c<ecol) colflags[i] = 1; else break; }
				}
			});
			hidecolumns('','noundo');
		}
	}
	redraw();
}

// Delegated closing of dialog windows
function closewindow(elem,addfunc){
	if(!elem) elem = $(this||'div.popupwindow');
	else if(typeof(elem)=='string') elem = elem=='all'? $('div.popupwindow') : $('#'+elem);
	else elem = $(elem);
	var windiv = elem.hasClass('popupwindow')? elem : elem.closest('div.popupwindow');
	if(typeof(addfunc)=='function') windiv.find('.closebtn').click(addfunc);
	else windiv.find('.closebtn').click();
}

/* Generate pop-up windows */
function makewindow(title,content,options,container){ //(string,array(,obj{flipside:'front'|'back',backfade,btn:string|jQObj|array,id:string},jQObj))
	if(!options) options = {};
	if(!$.isArray(content)) content = [content];
	var animate = settingsmodel.windowanim();
	if(options.id && $('#'+options.id).length!=0){ $('#'+options.id).remove(); }//kill clones
	if(options.flipside){ //we make two-sided window
		var sideclass = 'side '+options.flipside;
		if(!animate) sideclass += ' notransition';
	} else if(animate){ var sideclass = 'zoomin'; } else { var sideclass = ''; }
	var windowdiv = $('<div class="popupwindow '+sideclass+'"></div>');
	if(options.id) windowdiv.attr('id',options.id);
	var shade = $("#backfade");
	var closebtn = $('<span class="closebtn" title="Close window">'+svgicon('x')+'</span>');
	var closefunc = function(){ //close window
		var wrapdiv = container ? container : windowdiv; 
		wrapdiv.removeClass('zoomed');
		if(animate) setTimeout(function(){ wrapdiv.remove() },600); else wrapdiv.remove();
		if(shade.css('display')!='none'){ shade.fadeOut(); }
		if(options.closefunc) options.closefunc();
	};
	closebtn.click(closefunc);
	if(options.btn){ //add buttons
		if(typeof(options.btn)=='string'||options.btn.jquery){ options.btn = [options.btn]; var align = 'center'; }//one btn
		else{ var align = 'right'; }//array of btns
		var btndiv = $('<div class="btndiv" style="text-align:'+align+'">');
		$.each(options.btn,function(b,btn){
			if(typeof(btn)=='string'){ btndiv.append($('<a class="button grey">'+btn+'</a>').click(closefunc)); }
			else{ if(btn.attr('class').split(' ').length==1) btn.addClass("grey"); btndiv.append(btn); }
		});
		content.push(btndiv);
	}
	var titlediv = $('<div class="windowtitle"></div>');
	var contentdiv = $('<div class="windowcontent"></div>');
	contentdiv.css('max-height', $('#page').height()-100+'px');
	if(options.nowrap) contentdiv.css('white-space','nowrap');
	var headerdiv = $('<div class="windowheader"></div>');
	if(options.header){ $.each(options.header,function(i,val){ headerdiv.append(val) }); }
	if(options.icn){ if(options.icn.indexOf('.')==-1) options.icn+='.png'; title = '<img class="windowicn" src="images/'+options.icn+'"> '+title; }
	titlediv.html(title);
	$.each(content,function(i,item){ contentdiv.append(item); });
	windowdiv.append(headerdiv,contentdiv,titlediv,closebtn);
	if(container) container.append(windowdiv); //add window to webpage
	else $("#page").append(windowdiv);
	
	var dragdiv = container||windowdiv, page = {w:$('#page').width(), h:$('#page').height()}, win = {w:windowdiv.width(), h: windowdiv.height()};
	var toFront = function(windiv,first){ //bring window on top
		var maxz = Math.max.apply(null, $.map($('#page>div.popupwindow,div.popupwrap'), function(e,i){ return parseInt($(e).css('z-index'))||1; }));
		var curz = parseInt($(windiv).css('z-index'));
		if((curz<maxz) || (curz==maxz&&first)) $(windiv).css('z-index',maxz+1);
    }
	if(options.backfade){ //place window to center
    	dragdiv.css({'top':(page.h/2)-(win.h/2)+'px','left':(page.w/2)-(win.w/2)+'px'});
    }
	if($('#page>div.popupwindow').length){ //place a new window to shifted overlap
		toFront(dragdiv,'first');
		var pos = $('#page>div.popupwindow').last().position();
		dragdiv.css({'top':pos.top+20+'px','left':pos.left+20+'px'});
	}
	
	dragdiv.mousedown(function(){ toFront(dragdiv) });
	if(container && win.w>container.width()) container.css('width',win.w+'px');
	if(container && win.h>container.height()) container.css('height',win.h+'px');
	setTimeout(function(){
	  	dragdiv.draggable({ //make window draggable by its title
			handle : "div.windowtitle",
			containment : [10,10,page.w-dragdiv.width()-20,page.h-40]
	}); }, 800); //add lag to get window dimensions
    if(options.backfade){ //make stuff visible
    	shade.fadeIn({complete:function(){ if(animate) dragdiv.addClass('zoomed'); }});
    }
    else if(animate){ setTimeout(function(){ dragdiv.addClass('zoomed') }, 100); }
    setTimeout(function(){ dragdiv.addClass('finished') }, 900); //avoid transition bugs
	return windowdiv;
}

//create arrowed titles for collapsible divs
function expandtitle(options){
	var arrow = $('<span class="rotateable">&#x25BA;</span>');
	var titlespan = $('<span class="action" title="'+(options.desc||'Click to toggle content')+'">'+(options.title||'View/hide')+'</span>');
	titlespan.click(function(){
		var content = options.target||$(this).parent().next(".insidediv");
		if(arrow.hasClass('rotateddown')){
			arrow.removeClass('rotateddown');
			if(options.minh) content.animate({height:options.minh});
			else content.slideUp();
			if(typeof(options.onhide)=='function') options.onhide();	
		}
		else{
			arrow.addClass('rotateddown');
			if(options.maxh){
				if(isNaN(options.maxh)) options.maxh = content[0].scrollHeight;
				content.animate({height:options.maxh});
			}
			else content.slideDown();
			if(typeof(options.onshow)=='function') options.onshow();
		}
	});
	return $('<div>').append(arrow,titlespan);
}

//Content for different types of pop-up windows
function dialog(type,options){
	if(typeof(type.act)!='undefined') type = type.act;
	if($('#'+type).length){ $('#'+type).trigger('mousedown');  return; } //window laready created. bring it to front.
// file/data import window
	if(type=='import'){
		$('div.popupwindow').remove(); //close other windows
		var fileroute = window.File && window.FileReader && window.FileList ? 'localread' : 'upload';
		
		var localhelp = 'Select file(s) that contain aligned or unaligned sequence (and tree) data. Supported filetypes: fasta, newick (.tree), HSAML (.xml), NEXUS, phylip, ClustalW (.aln), phyloXML';
		var localheader = '<div class="sectiontitle"><img src="images/hdd.png"><span>Import local files</span><span class="svg" title="'+localhelp+'">'+svgicon('info')+'</span></div><br>';
		
		var filedrag = $('<div class="filedrag">Drag files here</div>');
		filedrag.bind('dragover',function(evt){ //file drag area
			filedrag.addClass('dragover');
			evt.stopPropagation();
    		evt.preventDefault();
    		evt.originalEvent.dataTransfer.dropEffect = 'copy';
    	}).bind('dragleave',function(evt){
			filedrag.removeClass('dragover');
			evt.stopPropagation();
    		evt.preventDefault();
    	}).bind('drop',function(evt){
    		evt.stopPropagation();
    		evt.preventDefault();
    		filedrag.removeClass('dragover');
    		checkfiles(evt.originalEvent.dataTransfer.files,fileroute);
    	});
    	
		var fileinput = $('<input type="file" multiple style="opacity:0" name="upfile">');
		var form = $('<form enctype="multipart/form-data" style="position:absolute">');
		form.append(fileinput);
		filedrag.append(form);
		fileinput.change(function(){ checkfiles(this.files,fileroute) });
		
		var selectbtn = $('<a class="button" style="vertical-align:0">Select files</a>');
		selectbtn.click(function(e){ fileinput.click(); e.preventDefault(); });
		var or = $('<div style="display:inline-block;font-size:18px;"> or </div>');
		
		var otherhelp = 'Type a web address of a remote data file or Wasabi share link, or paste a raw text of sequence/tree data';
		var remoteheader = '<br><br><div class="sectiontitle"><img src="images/web.png"><span>Import from other sources</span><span class="svg" title="'+otherhelp+'">'+svgicon('info')+'</span></div><br>';
		var urladd = $('<a title="Add another input field" class="button urladd">+</a>'); //url inputs+buttons
		var urlinput = $('<textarea type="url" class="url" placeholder="Type a web address or raw data">');
		var expbtn = $('<span class="action icon" style="margin-left:-4px;vertical-align:7px" title="Expand/collapse the input field">&#x25BC;</span>');
		expbtn.click(function(){
			var self = $(this), field = self.prev("textarea");
			if(self.html()=='\u25BC'){ field.css('height','80px'); setTimeout(function(){self.html('\u25B2')},400); }
			else{ field.css('height',''); setTimeout(function(){self.html('\u25BC')},400); }
		});
		urladd.click(function(){
			var rmvbtn = $('<a title="Remove this input" class="button urladd" style="padding:2px 2px 6px">-</a>');
			rmvbtn.click(function(){
				var curbtn = $(this), curinput = curbtn.next("textarea");
				var rmvarr = [curbtn.prev("br"),curbtn,curinput,curinput.next("span.icon")];
				$.each(rmvarr,function(i,el){ el.remove() });
			});
			var lastel =  $("#import span.action.icon").last();
			lastel.after("<br>",rmvbtn,urlinput.clone().css('height','').val(''),expbtn.clone(true).html('\u25BC'));
		});
		
		var dwnlbtn = $('<a class="button">Import</a>');
		dwnlbtn.click(function(){
			var urlarr = [];
			$("#import .front .windowcontent textarea.url").each(function(i,input){
				var val = $(input).val();
				if(!val) return true;
				if(~val.indexOf('share=') && ~val.indexOf('file=')){
					var urlind = val.lastIndexOf('?');
					var urlvars = parseurl(val.substring(urlind+1));
					urlvars.host = val.substring(0,urlind);
					urlarr.push({name:urlvars.name||'shared data',share:urlvars,url:val});
				}
				else if(val.substr(0,7)=='http://'){
					var filename = val.substring(val.lastIndexOf('/')+1);
					urlarr.push({name:filename, url:val});
				}
				else{ urlarr.push({name:'text input '+(i+1), text:val}); }
				
			});
			checkfiles(urlarr,'download'); 
		});
		
		var ensheader = '<br><br><div class="sectiontitle"><img src="images/ensembl.png"><span>Import from <a href="http://www.ensembl.org" target="_blank">Ensembl</a></span>'+
		'<span class="svg" title="Retrieve a set of homologous sequences corresponding to Ensembl Gene ID'+
		(ensemblmodel.idformats.length==3?', GeneTree ID or a region from an EPO alignment block':' or GeneTree ID')+'">'+svgicon('info')+'</span></div><br>';
		
		var enscontent = '<div style="padding:0 10px"><select data-bind="options:idformats, optionsText:\'name\', value:idformat"></select>'+
		' <input style="width:210px" type="text" data-bind="attr:{placeholder:idformat().example},value:ensid"><br>'+
		
		'<div data-bind="slidevisible:idformat().name==\'Gene\'">Find Ensembl Gene ID:<br>'+
		'species <input type="text" data-bind="value:idspecies"/> gene name <input type="text" data-bind="value:idname" style="width:80px"/> '+
		'<a id="ensidbtn" class="button square"  style="margin:0" onclick="ensemblid()">Search</a></div>'+
		'<div data-bind="slidevisible:idformat().name==\'EPO alignment\'"><span class="cell">Pipeline type<hr><select data-bind="options:epolist,optionsText:\'type\',value:epotype"></select></span>'+
		'<span class="cell" data-bind="with:epotype">Species set<hr><select data-bind="options:set,optionsText:\'name\',value:$parent.eposet"></select></span>'+
		'<span class="cell" data-bind="with:eposet">Reference species<hr><span class="camelcase" data-bind="text:ref.replace(\'_\',\' \')"></span></span></div>'+
		
		'<span style="color:#888">Options:</span><br>'+
		'<ul data-bind="slidevisible:idformat().name!=\'EPO alignment\'">'+
		  '<li>Import <span data-bind="visible:idformat().name==\'Gene\'">unaligned</span>'+
			'<select data-bind="visible:idformat().name!=\'Gene\',value:aligned"><option value="true">aligned</option><option value="">unaligned</option></select>'+
			' <select data-bind="value:seqtype"><option value="cdna">cDNA</option><option value="protein">protein</option></select> sequences</li>'+
		  '<li data-bind="slidevisible:idformat().name==\'Gene\'">Include <select data-bind="value:homtype" style="margin-top:5px"><option value="all">all homologous</option>'+
			'<option value="orthologues">orthologous</option><option value="paralogues">paralogous</option></select> genes</li>'+
		  '<li data-bind="slidevisible:idformat().name==\'Gene\'">Restrict to a target species <input type="text" data-bind="value:target" style="width:100px"/></li></ul>'+
		'<ul data-bind="slidevisible:idformat().name==\'EPO alignment\'">'+
		'<li>Use Ensembl database version <select data-bind="options:dbopt,value:dbver"></select></li>'+
		'<li>Import <select data-bind="options:maskopt,value:mask"></select> sequences.</ul></div>'+
		
		'<a id="ensbtn" class="button" onclick="ensemblimport()">Import</a> <span id="enserror" class="note" style="color:red"></span>'+
		'<span data-bind="fadevisible:epojob">Fetching: <span class="progressline" style="width:200px"><span class="bar" data-bind="style:{width:epojobperc}"></span></span></span>';
		
		var animclass = settingsmodel.windowanim()? 'zoomin' : '';
		var dialogwrap = $('<div id="import" class="popupwrap '+animclass+'"></div>');
		$("#page").append(dialogwrap);
		var dialogwindow = makewindow("Import data",[localheader,filedrag,or,selectbtn,ensheader,enscontent,remoteheader,urladd,urlinput,expbtn,'<br>',dwnlbtn],{backfade:true,flipside:'front',icn:'import.png',nowrap:true},dialogwrap);
		ko.applyBindings(ensemblmodel,dialogwindow[0]);
		
		setTimeout(function(){
			makewindow("Import data",[],{backfade:false,flipside:'back',icn:'import.png'},dialogwrap);
		},1000);
	}
// file export window	
	else if(type=='export'){
		exportmodel.filename(exportmodel.savename().replace(' ','_'));
		var flipexport = function(){
			$("#exportwrap").removeClass('finished flipped');
			setTimeout(function(){ $("#exportwrap").addClass('finished') },900); //avoid firefox transition bugs
		};
		if($("#exportwrap").length){ //use existing window
			$("#exportwrap").click();
			flipexport();
			if(options) parseexport('',options);
			return;
		}
		
		var animclass = settingsmodel.windowanim()? 'zoomin' : '';
		var exportwrap = $('<div id="exportwrap" class="popupwrap '+animclass+'">');
		$("#page").append(exportwrap);
		var hasancestral = treesvg.data && treesvg.data.root.children.length==3?true:false;
		
		var frontcontent = $('<div class="sectiontitle" style="min-width:320px"><img src="images/file.png"><span>File</span></div>'+
		'<span class="cell">Data<hr><select data-bind="options:categories, optionsText:\'name\', value:category"></select></span>'+
		'<span class="cell" data-bind="fadevisible:category().formats.length,with:category">Format<hr><span data-bind="visible:formats.length==1,text:formats[0].name"></span><select data-bind="visible:formats.length>1, options:formats, optionsText:\'name\', value:$parent.format"></select></span>'+
		'<span class="cell" data-bind="with:format,fadevisible:format().variants.length>1">Variant<hr><select data-bind="options:variants, optionsText:\'name\', value:$parent.variant"></select></span> '+
		'<span class="svgicon" style="margin-left:-8px" data-bind="fadevisible:variant().desc,attr:{title:variant().desc,onclick:infolink()}">'+svgicon('info')+'</span>'+
		'<br>&nbsp;Name: <input type="text" class="faded" style="width:200px;text-align:right;margin:0" title="Click to edit" data-bind="value:filename">'+
			'<span style="font-size:17px" data-bind="visible:variant().ext.length<2,text:variant().ext[0]"></span>'+
			'<select data-bind="visible:variant().ext.length>1, options:variant().ext, value:fileext"></select>'+
		'<br><br><div class="sectiontitle"><img src="images/gear.png"><span>Options</span></div>'+
		(hasancestral?'<input type="checkbox" data-bind="checked:includeanc"> Include ancestors':'')+
		//'  <input type="checkbox" data-bind="visible:curitem().interlace,checked:interlaced"><span class="label" title="Interlace sequence data rows" data-bind="visible:curitem().interlace">Interlaced</span>'+
		'<br><input type="checkbox" data-bind="checked:trunc">Truncate names to first <select data-bind="options:[\'\',\'space\',\'digit\',\',:!?/...\'],value:truncsymbol"></select> and <input type="text" class="num" data-bind="value:trunclen">letters'+
		'<div data-bind="slidevisible:category().name.indexOf(\'Seq\')!=-1">&nbsp;Mark masked sequence with <select data-bind="options:maskoptions,value:masksymbol"></select>'+
		'<br><input type="checkbox" data-bind="checked:includehidden">Include hidden columns</div></div>');
		
		var makebtn = $('<a class="button orange" data-bind="visibility:format">Make file</a>');
		makebtn.click(function(){ parseexport(); });
		var frontwindow = makewindow("Export data",frontcontent,{icn:'export.png',id:'exportwindow',flipside:'front',btn:makebtn,nowrap:true},exportwrap);
		
		var backcontent = $('<div class="sectiontitle"><img src="images/file.png"><span data-bind="text:filename()+(~filename().indexOf(\'.\')?\'\':fileext())"></span></div>'+
		'<div class="insidediv" style="max-width:400px;max-height:150px;overflow:auto"><div class="paper"></div></div>');
		var backbtn = $('<a class="button" style="padding-left:17px;margin-top:25px"><span style="vertical-align:2px">&#x25C0;</span> Options</a>');
		backbtn.click(function(){ flipexport(); exportmodel.filename(exportmodel.savename().replace(' ','_')); });
		
		var downloadbtn = $('<a class="button" style="margin-left:40px;margin-top:25px" data-bind="visible:fileurl,attr:{href:fileurl}">Download</a>');
		var backwindow = makewindow("Export data",[backcontent,backbtn,downloadbtn],{icn:'export.png', id:'exportedwindow', flipside:'back'},exportwrap);
		
		ko.applyBindings(exportmodel,exportwrap[0]);
		if(options) parseexport('',options);
	}
// save data to library	
	else if(type=='save'){
		var content = 'Save current data as <span data-bind="visible:savetargets().length==1,text:savetarget().name"></span><select data-bind="visible:savetargets().length>1, options:savetargets, optionsText:\'name\', value:savetarget"></select> analysis in the library.<br><br>'+
		'<span data-bind="fadevisible:savetarget().type!=\'overwrite\'">Name: <input type="text" class="hidden" title="Click to edit" data-bind="value:savename"></span>';
		var savebtn = $('<a class="button orange" onclick="savefile(this)">Save</a>');
		var savewindow = makewindow("Save to libray",[content],{icn:'save.png', id:type, btn:savebtn});
		ko.applyBindings(exportmodel,savewindow[0]);
	}
// stats about current data
	else if(type=='info'){
		var lib = librarymodel;
		var sharelink = ~model.sourcetype().indexOf('local')? '':lib.shareicon(lib.getitem(lib.openid()),'','Share the source data',lib.importurl);
    					
		var list = '<ul>'+
		'<li data-bind="visible:treesource">Number of tree nodes: <span data-bind="text:nodecount"></span></li>'+
		'<li data-bind="visible:treesource">Number of tree leafs: <span data-bind="text:leafcount"></span></li>'+
		'<li>Number of sequences: <span data-bind="text:seqcount"></span>, in total of <span data-bind="text:totalseqlength"></span></li>'+
		'<li>Sequence length: from <span data-bind="text:minseqlength"></span> to <span data-bind="text:maxseqlength"></span></li>'+
		'<li>Sequence matrix length: <span data-bind="text:alignlength"></span> columns '+
		'<span data-bind="visible:hiddenlen,text:\'(\'+hiddenlen()+\' columns hidden)\'"></span></li>'+
		'<li>Sequence matrix height: <span data-bind="text:alignheight"></span> rows</li>'+
		'<li data-bind="visible:sourcetype">Data source: <span data-bind="text:sourcetype"></span> '+sharelink+'</li>'+
		'<li data-bind="visible:treesource()&&!ensinfo().type">Tree file: <span data-bind="text:treesource"></span></li>'+
		'<li data-bind="visible:seqsource()&&!ensinfo().type">Sequence file: <span data-bind="text:seqsource"></span></li>'+
		'</ul>';
		
		var enslist = '<div data-bind="if:ensinfo().type" style="margin-top:5px"><span style="color:#666">About Ensembl dataset:</span><br>'+
		'<ul data-bind="with:ensinfo"><!-- ko if: type==\'homology\' -->'+
		'<li>Homologs to <span data-bind="text:species"></span> gene '+
		'<a data-bind="attr:{href:\'http://www.ensembl.org/\'+species.replace(\' \',\'_\')+\'/Gene/Summary?g=\'+id,target:\'_blank\',title:\'View in Ensembl\'},text:id"></a></li>'+
		'<!-- /ko --><!-- ko if: type==\'genetree\' -->'+
		'<li>Genetree <a data-bind="attr:{href:\'http://www.ensembl.org/Multi/GeneTree?gt=\'+id,target:\'_blank\',title:\'View in Ensembl\'},text:id"></a></li>'+
		'<!-- /ko --></ul></div>';
		
		var dialogwindow = makewindow("Data information",[list,enslist],{btn:'OK',icn:'info.png',id:type});
		ko.applyBindings(model,dialogwindow[0]);
	}
// start a new alignment job
	else if(type=='align'){
		var nameinput = $('<input type="text" class="hidden" value="'+exportmodel.savename()+'" title="Click to edit">');
		var namespan = $('<span class="note">Descriptive name: </span>').append(nameinput);
		var infospan = $('<span class="note" style="display:none;margin-left:20px">Hover options for description</span>');
		var opttitle = expandtitle({title:'Alignment options', desc:'Click to toggle options', onshow:function(){infospan.fadeIn()}, onhide:function(){infospan.fadeOut()}}).append(infospan);
		var tunetitle = expandtitle({title:'Fine-tuning', desc:'Click to toggle additional parameters'}).css('margin-top','5px');
		var treecheck = $.isEmptyObject(treesvg)?'checked="" disabled=""':''; //new tree needed
		var parentoption = librarymodel.openparent()?'<option>sibling</option>':'';
		var writetarget = librarymodel.openid()?'<span class="label" title="Specify the saving place for the new analysis in the library, relative the to the input (currently open) analysis">'+
		'Save as a</span> <select name="writemode">'+parentoption+'<option '+(librarymodel.openparent()?'':'selected="selected"')+'>child</option>'+
		'<option>overwrite</option></select> of current analysis in the <a onclick="dialog(\'library\'); return false">library</a>.<br><br>':'';
		
		var optform = $('<form id="alignoptform" onsubmit="return false">'+writetarget+
		'<input type="checkbox" name="newtree" '+treecheck+'><span class="label" title="Create a new NJ tree to guide the sequence alignment process (uncheck to use the current tree)">create a guidetree</span>'+
		'<br><input type="checkbox" checked="checked" name="anchor"><span class="label" title="Use Exonerate anchoring to speed up alignment">alignment anchoring</span> '+
		'<br><input type="checkbox" name="iterate" data-bind="checked:iterate"><span class="label" title="Iterating re-alignment cycles can improve tree phylogeny. Uncheck this option to keep the input tree intact">'+
			'iterate alignment for</span> <select name="rounds"><option>2</option><option>3</option><option>4</option><option selected="selected">5</option></select> cycles'+
		'<br><div class="sectiontitle small"><span class="grey">or</span></div>'+
		'<input type="checkbox" name="e"><span class="label" title="Keep current alignment intact and just add sequences for ancestral nodes">keep alignment</span></form>');
		var tunediv = $('<div class="insidediv numinput" style="display:none;margin-bottom:0">'+
		  '<input type="checkbox" checked="checked" name="F"><span class="label" title="Force insertions to be always skipped. Enabling this option is generally beneficial but may cause an excess of gaps if the guide tree is incorrect">trust insertions (+F)</span>'+
		  '<br><input type="checkbox" name="nomissing"><span class="label" title="Do not treat gaps as missing data. Use +F for terminal gaps">no missing data</span>'+
		  '<div class="sectiontitle small"><span>alignment model parameters</span></div>'+
		  '<div data-bind="visible:isdna"><input type="checkbox" name="translate">'+
		    '<span class="label" title="Translate and align cDNA with protein or codon model">align as</span>'+
		      ' <select name="translateto" data-bind="options:transopt,optionsText:\'t\',optionsValue:\'v\'"></select>'+
			'<br><span class="label" title="Default values are empirical, based on the input data">DNA base frequencies</span>'+
			' <input type="text" name="A" placeholder="A"><input type="text" name="C" placeholder="C"><input type="text" name="G" placeholder="G"><input type="text" name="T" placeholder="T">'+
			'<br><span class="label" title="Transition/transversion rate ratio in substitution model">K</span> <input type="text" name="kappa" class="num" placeholder="2">'+
			' <span class="label" title="Purine/pyrimidine rate ratio in substitution model">P</span> <input type="text" name="rho" class="num" placeholder="1"></div>'+
		  '<span class="label" title="Gap opening rate">gap opening</span> <input type="text" name="gaprate" style="width:45px" data-bind="attr:{placeholder:gaprate}">'+
			' <span class="label" title="Gap extension probability">gap extension</span> <input type="text" name="gapext" data-bind="attr:{placeholder:gapext}" style="width:40px">'+
		  '<div data-bind="visible:iterate" class="sectiontitle small"><span class="label" title="The optimization score is used to assess an alignment iteration result">optimization scoring</span></div>'+
		  '<div data-bind="visible:iterate"><span class="label" title="Indel penalties for alginment scoring (with substitution penalty as 1)">indels with length</span> 1:'+
		    '<input type="text" name="ind1" placeholder="6" class="num"> 2:<input type="text" name="ind2" placeholder="8" class="num"> 3:<input type="text" name="ind3" placeholder="9" class="num"> 4+:<input type="text" name="ind4" placeholder="10" class="num"></div>'+
		  '<hr><span class="label" title="Specifing a seed number allows reproducing alignment results">random number seed</span> <input type="text" name="seed">'+
		  '<br><input type="checkbox" name="uselogs"><span class="label" title="Slow, but may be needed for very large number of sequences">use log space</span></div>');
		optform.append(tunetitle,tunediv);
		var optdiv = $('<div class="insidediv" style="display:none">').append(optform);
		
		var alignbtn = $('<a class="button orange">Start alignment</a>');
		alignbtn.click(function(){ sendjob({form:$('form',optdiv)[0],btn:alignbtn,name:nameinput.val()}); });
		
		var dialogwindow = makewindow("Make alignment",['Current sequence data will be aligned with <a href="http://prank-msa.googlecode.com" target="_blank">Prank</a> aligner.<br><hr>',namespan,opttitle,optdiv,'<br>'],{id:type, btn:alignbtn, icn:'icon_prank', nowrap:true});
		ko.applyBindings(model,dialogwindow[0]);
	}
// notifications & submitted job status window
	else if(type=='jobstatus'){
		communicate('getlibrary'); //sync data
		var sections = [];
		//set up sections of notifications window
		var notifheader = $('<div class="sectiontitle" data-bind="visible:notifications"><img src="images/info.png"><span>Notifications</span></div>');
		
		var treenotif = $('<div data-bind="visible:treealtered" class="sectiontext">'+
		'The tree phylogeny has been changed and the sequence alignment needs to be updated to reflect the new tree.<br>'+
		'<a class="button square red" data-bind="visible:treebackup" onclick="model.selectundo(\'firsttree\'); model.undo(); return false;" title="Undo tree modifications">Revert changes</a></div>');
		var realignbtn = $('<a class="button square orange" title="Realign current dataset with PRANK">Realign</a>');
		var optform = librarymodel.openid()? $('<form id="realignoptform" onsubmit="return false">The realignment will <select name="writemode">'+
		(librarymodel.openparent()?'<option value="sibling" checked="checked">branch parent</option>':'')+
		'<option value="child" '+(librarymodel.openparent()?'':'checked="checked"')+'>branch current</option>'+
		'<option value="overwrite">overwrite current</option></select> analysis files in the <a onclick="dialog(\'library\'); return false;">library</a>.</form>') : [''];
		realignbtn.click(function(){ sendjob({form:optform[0],btn:realignbtn,realign:true}) });
		treenotif.append(realignbtn,optform,'<hr>');
		
		var ancnotif = $('<div data-bind="visible:noanc" class="sectiontext">'+
		'Current phylogenetic tree is missing sequences for ancestral nodes. Wasabi can use the PRANK aligner to infer the ancestral sequences and add it to the dataset.<br>'+
		'<a class="button square" onclick="model.noanc(false); return false;">Dismiss</a> <a class="button square orange" onclick="sendjob({btn:this,ancestral:true})">Add ancestors</a><hr></div>');
		
		var offlinenotif = $('<div data-bind="visible:offline" class="sectiontext">The Wasabi server is currently out of reach, so some functions may not work.<br>'+
		'<a class="button square orange" onclick="communicate(\'checkserver\',\'\',{btn:this,retry:true,restore:true})" title="Check server connection">Reconnect</a>'+
		'<a class="button square" href="http://wasabi2.biocenter.helsinki.fi/feedback">Contact us</a> <hr></div>');
		
		var errornotif = $('<div data-bind="visible:errors" class="sectiontext">An error occured when communicating with Wasabi server, so some functions may not work.<br>'+
		'The list of errors has been saved. In addition, your feedback would help us to fix the issue.<br>'+
		'<a class="button square" onclick="model.errors(\'\');">Dismiss</a> <a class="button square" onclick="dialog(\'errorlog\')">View errors</a> '+
		'<a class="button square" href="http://wasabi2.biocenter.helsinki.fi/feedback" traget="_blank">Contact us</a> <hr></div>');
		
		var newver = model.version.remote();
		var updatenotif = $('<div data-bind="visible:update" class="sectiontext">'+
		'There is an update available for Wasabi (current v.'+model.version.local+').<div class="insidediv">Wasabi version '+newver+':'+
		'<br><ul><li>'+model.version.lastchange.replace(/\* /g,'</li><li>')+'</li></ul></div></div>');
		var skipbtn = $('<a class="button square red" title="Skip this version">Skip</a>');
		skipbtn.click(function(){ settingsmodel.skipversion(newver); settingsmodel.saveprefs(); });
		updatebtn = $('<a class="button square orange" data-bind="visible:settingsmodel.autoupdate" title="Auto-update Wasabi">Update</a>');
		updatebtn.click(function(){ communicate('update','',{btn:updatebtn, success:function(resp){
			if(~resp.indexOf('Updated')){
				updatebtn.text('Update complete');
				setTimeout(function(){ model.version.remote(model.version.local); closewindow('all'); }, 2000);
				setTimeout(function(){ makewindow('Wasabi updated','Wasabi is now updated to version '+newver+
				'.<br> To continue, close the web browser window and restart Wasabi.',{icn:'info',backfade:true}); }, 3000);
		}}});});
		var dwnldbtn = $('<a class="button square" href="http://wasabi2.biocenter.helsinki.fi/downloads" target="_blank" title="Manually download and update Wasabi">Download</a>');
		dwnldbtn.click(function(){
			updatenotif.html('To complete the update, replace the current Wasabi application with the downloaded app and relaunch Wasabi.');
			setTimeout(function(){ model.version.remote(model.version.local); }, 7000);
		});
		updatenotif.append(skipbtn,updatebtn,dwnldbtn,'<hr>');
		
		sections.push(notifheader,treenotif,ancnotif,offlinenotif,errornotif,updatenotif);
		$.each(sections,function(i,section){
    		ko.applyBindings(model, section[0]); //bind html with the main datamodel
		});
		//HTML for representing running server jobs:
		var jobslist = $('<div><div class="sectiontitle" data-bind="visible:jobsview().length"><img src="images/run.png">'+
		'<span>Status of background tasks</span></div><div class="insidediv" data-bind="visible:jobsview().length,'+
		'foreach:{data:jobsview, afterAdd:addanim}"><div class="itemdiv" data-bind="attr:{id:\'job_\'+id}">'+
		  '<span class="note">Name:</span> <span class="logline" data-bind="text:name"></span><br>'+
		  '<span class="note">Status:</span> <span data-bind="text:[status(),\'Failed\',\'Finished\'][st()], css:{red:st()==1,label:true},'+
		  'attr:{title:st()==1?(outfile()?\'Job cancelled. Exit code \'+status():\'No output file\'):\'No errors\'}"></span><br>'+
		  '<span class="note">Job type:</span> <span data-bind="text:$data.type?type():\'Prank alignment\'"></span>'+
		  '<a class="button itembtn" data-bind="text:[\'Kill\',\'Delete\',\'Import\'][st()], css:{red:st()!=2},'+
		    'attr:{title:[\'Cancel job\',\'Delete data\',\'Import to library\'][st()]},'+
		    'click:st()==2?$parent.importitem:$parent.removeitem"></a><br>'+
		  '<span class="note">Created:</span> <span data-bind="text:msectodate(starttime())"></span> '+
		  '<span class="importtick" title="Moves files to analysis library without loading it to the browser" data-bind="visible:st()==2">'+
		    '<input type="checkbox"><span class="label">Just move data</span></span>'+
		  '<a class="button itembtn" style="top:65%" data-bind="visible:st()==1&&~log().indexOf(\'done\'),click:$parent.importitem" '+
		    'title="Move data to analysis library (for further inspection)">Move to library</a><br>'+
		  '<span class="note">Job ID:</span> <span data-bind="text:id"></span><br>'+
		  '<span class="note">Feedback:</span> <span class="logline action" '+
		    'data-bind="click:function(itm,evt){ $parent.showfile(itm,evt,itm.logfile) },'+
		    'attr:{title:\'Last update \'+msectodate(lasttime)+\'. Click for full log.\'},html:$parent.parselog($data)"></span>'+
		'</div><div class="insidediv logdiv" style="display:none"></div><hr></div></div>');
		ko.applyBindings(librarymodel, jobslist[0]); //bind html with data from the library datamodel
		
		makewindow("Status overview",[sections,jobslist],{id:type,icn:'status'});
	}
// analyses library
    else if(type=='library'){
    	communicate('getlibrary'); //sync data
    	
    	var header = $('<a class="button square back" title="View parent analysis" data-bind="fadevisible:cwd,click:updir">&#x25C0;</a>'+
    	'<span class="dirtrail"><span class="text"><span class="svgicon">'+svgicon('home')+'</span><span data-bind="html:dirpath().join(\' &#x25B8; \')"></span></span><span class="leftfade"></span></span>'+
    	' <span style="position:absolute;top:6px;right:15px;">Sort by: <select data-bind="options:sortopt,optionsText:\'t\',optionsValue:\'v\',value:sortkey"></select> '+
    	'<span class="icon action" style="font:20px/16px sans-serif;vertical-align:-2px" data-bind="html:sortasc()?\'\u21A7\':\'\u21A5\',click:function(){sortasc(!sortasc())},'+
    	'attr:{title:sortasc()?\'ascending\':\'descending\'}"></span></span>');
		
    	var content = $('<div class="insidediv" data-bind="foreach:{data:libraryview,afterAdd:addanim}">'+
    	'<div class="itemdiv" style="height:" data-bind="css:{activeitem:id==$parent.openid(),compact:settingsmodel.minlib}"><div>'+
    	  '<span class="note">Name:</span> <input type="text" class="hidden" data-bind="value:name" title="Click to edit name"><br>'+
		  '<span class="note">Last opened:</span> <span data-bind="text:msectodate($data.imported)"></span><br>'+
		  '<span class="note">Analysis ID:</span> <span class="rotateable">&#x25BA;</span><span class="action" title="Browse data files" data-bind="click:$parent.showfile, text:id"></span><br>'+
		  '<span data-bind="visible:$data.outfile,html:$parent.shareicon($data,false,\'Share this analysis\')"></span>'+
		  '<a class="button itembtn" data-bind="visible:$data.outfile,click:function(item,e){getfile({id:item.id,file:item.outfile(),btn:e.target})}, text:id==$parent.openid()?\'Restore\':\'Open\', '+
		    'attr:{title:id==$parent.openid()?\'Revert back to saved state\':\'Load data\'}"></a>'+
		  '<span class="note">Created:</span> <span data-bind="text:msectodate($data.starttime)"></span><br>'+
		  '<span class="note">Last saved:</span> <span data-bind="text:msectodate($data.savetime)"></span><br>'+
		  '<span class="note">Data source:</span> <span data-bind="text:$data.aligner?aligner+\' alignment\':'+
		    '\'Imported from \'+($data.source||\'files\'), css:{label:$data.parameters}, attr:{title:$data.parameters?\'Started with: \'+$data.parameters:\'\'}"></span>'+
		  '<a class="button itembtn childbtn" data-bind="visible:children, click:function(data){$parent.dirpath.push(data.id)},'+
		    'css:{activeitem:~$parent.openpath().indexOf(id)}" title="View subanalyses"><span class="svg">'+svgicon('children')+
		    '</span> <span data-bind="text:children"></span></a>'+
		  '<a class="button itembtn removebtn" data-bind="click:$parent.removeitem, attr:{title:\'Delete analysis \'+id+\' and its children\'}">Delete</a>'+
		  '<span class="action itemexpand" data-bind="click:$parent.toggleitem" title="Toggle additional info">&#x25BC; More info</span></div></div><hr></div>');
		  
		var librarywindow = makewindow("Library of analyses",content,{id:type,header:header,icn:'library.png'});
		ko.applyBindings(librarymodel,librarywindow[0]);
    }
// shortcut for error dialogs
	else if(type=='error'||type=='warning'||type=='notice'){
		makewindow(type.charAt(0).toUpperCase()+type.slice(1),options,{btn:'OK',icn:'warning'});
	}
// batch filter/collapse for sequence area
	else if(type=='seqtool'){
		var content = $('<div class="sectiontitle"><span>Filter alignment columns</span></div><div class="sectiontext">'+
		'Hide all sequence alignment columns where: '+
		'<ul><li><input type="checkbox" data-bind="checked:minhidelimit"> there is no sequence data, or</li>'+
		'<li>less than <input id="hidecolinp" type="text" class="num nogap" data-bind="value:hidelimit,valueUpdate:\'afterkeydown\'"> '+
		'<span class="note" style="min-width:85px;text-align:center" data-bind="text:\'(or <\'+hidelimitperc()+\'% of)\'"></span> rows contain sequence data.<br>'+
		'<span class="note">0%</span><span class="draggerline"></span><span class="note">100%</span></li>'+
		'<li>gaps <span data-bind="visible:model.hasdot">represent <select data-bind="options:[\'indels\',\'insertions\',\'deletions\'],value:gaptype"></select></span>'+
		'<span data-bind="visible:!model.hasdot()">are</span> longer than <input type="text" class="num nogap" data-bind="value:gaplen,valueUpdate:\'afterkeydown\'"> columns.</li>'+
		'<li>keep <input type="text" class="num nogap" data-bind="value:buflen,valueUpdate:\'afterkeydown\'"> columns from each gap edge visible.</li></ul>'+
		'</div><div>This will collapse <span data-bind="text:hidecolcount"></span> columns '+
		'<span class="note" data-bind="text:\'(\'+hidecolperc()+\'%)\'"></span> of sequence alignment.</div>');
		
		var slider = $('<span class="dragger" data-bind="style:{marginLeft:\'-7px\',left:hidelimitperc()+\'%\'}"></span>');
		var sliderline = $('.draggerline',content);
		sliderline.append(slider);
		
		var applybtn = $('<a class="button orange">Apply</a>');
		applybtn.click(function(){ //$("#seqtool .closebtn").click(); 
		closewindow(applybtn);
		setTimeout(function(){ hidecolumns(); },500); });
		
		var dialogwindow = makewindow('Sequence tools',content,{id:type,icn:'seq',btn:['Cancel',applybtn],closefunc:function(){clearselection()}});
		var slidew = sliderline.width();
		slider.draggable({ //slider for adjusting affected column cutoff
			axis: "x", 
			containment: 'parent',
			drag: function(e,elem){ toolsmodel.hidelimitperc((elem.position.left+4)/slidew*100) }
		});
		setTimeout(function(){toolsmodel.countgaps()},800);
		ko.applyBindings(toolsmodel,dialogwindow[0]);
	}
//batch edit/hide for tree area
	else if(type=='treetool'){
		var title = $('<div class="sectiontitle"><span>Prune tree leafs</span></div>');
		var content = $('<div class="sectiontext">You can mark/unmark tree leafs by clicking on a leaf name<br>or by dragging in the sequence area.<br><br></div>');
		
		var emptyleaves = [];
		$.each(leafnodes,function(name,node){ if(!sequences[name]) emptyleaves.push(name); });
   	  	if(emptyleaves.length){
   	  		var markbtn = $('<a class="button square small">Mark empty leafs</a>');
   	  		markbtn.click(function(){
   	  			$.each(leafnodes,function(name,node){ 
   	  				if(!sequences[name]) node.highlight(true); else node.highlight(false);
   	  		});});
   	  		var s = emptyleaves.length>1? ['s','ve'] : ['','s'];
   	  		content.append(emptyleaves.length+' leaf'+s[0]+' ha'+s[1]+' no sequence data.',markbtn,'<br><br>');
   	  	}
   	  	
		content.append('Then click "Apply" to <select data-bind="options:[\'hide\',\'prune\'],value:leafaction"></select> '+
		'<select data-bind="options:[\'marked\',\'unmarked\'],value:leafsel"></select> tree leafs.<br>'+
		'<span id="treetoolerror" style="color:red"></span>');
		
		var applybtn = $('<a class="button orange">Apply</a>');
		applybtn.click(toolsmodel.processLeafs);
		var closefunc = function(){ clearselection(); toolsmodel.markLeafs('unmark'); toolsmodel.prunemode = false; };
		
		var dialogwindow = makewindow('Tree tools',[title,content],{id:type,icn:'tree',btn:['Cancel',applybtn],closefunc:closefunc});
		clearselection(); toolsmodel.markLeafs('unmark'); toolsmodel.prunemode = true;
		if(model.selmode()!='rows') model.selmode('rows');
		ko.applyBindings(toolsmodel,dialogwindow[0]);
	}
//system preferences
	else if(type=='settings'){
		var content = $('<div class="insidediv" style="margin:0;padding:5px;">');
		content.append('<div class="row" style="width:380px" data-bind="visible:!model.offline()">'+
			'<span class="label" title="Session data is saved to analysis library">Autosave after every</span> <select data-bind="options:autosaveopt,value:autosaveint"></select>'+
			'<a class="button toggle" data-bind="css:{on:autosave},click:toggle.bind($data,autosave)"><span class="light"></span><span class="text" data-bind="text:btntxt(autosave)"></span></a></div>'+
		'<div class="row">Keep up to <select data-bind="options:[1,5,15,30],value:undolength"></select> <span class="label" title="Actions history enables to undo/redo previous data edits. With large datasets, it may affect the application performance.">actions in undo list</span>'+
		'<a class="button toggle" data-bind="css:{on:undo},click:toggle.bind($data,undo)"><span class="light"></span><span class="text" data-bind="text:btntxt(undo)"></span></a></div>'+
		'<div class="row" data-bind="visible:model.seqsource()">Colour sequences with <select data-bind="options:coloropt,value:colorscheme"></select> colour scheme<br>'+
		//'<span class="note" data-bind="text:colordesc[colorscheme()]"></span><br>'+
			'<span>Show letters in <select style="margin-top:10px" data-bind="options:fontopt,value:font"></select> with <select data-bind="options:[\'border\',\'no border\'],value:boxborder"></select></span></div>');
			
		var launchwrap = $('<div class="rowwrap">');
		var launchrows = $('<div class="row bottombtn">').append(expandtitle({title:'When Wasabi launches:', desc:'Click for additional settings. These settings take effect after reloading the web page'+(settingsmodel.local?' and/or restarting Wasabi server':''), target:launchwrap, minh:'34px', maxh:'auto'}).css('display','inline-block'));
		launchrows.append(' open <select style="margin-bottom:10px" data-bind="options:launchopt,value:onlaunch"></select><br>'+
			'Restore zoom level <a class="button toggle" data-bind="css:{on:keepzoom},click:toggle.bind($data,keepzoom)">'+
			'<span class="light"></span><span class="text" data-bind="text:btntxt(keepzoom)"></span></a>');
		launchwrap.append(launchrows);
		if(settingsmodel.local){
			launchwrap.append('<div class="row">Check for updates <a class="button square small" style="margin:-5px 20px 0;font-size:14px" onclick="checkversion(this)">check now</a> <a class="button toggle" data-bind="css:{on:checkupdates},click:toggle.bind($data,checkupdates)">'+
			'<span class="light"></span><span class="text" data-bind="text:btntxt(checkupdates)"></span></a></div>'+
			'<div class="row"><span class="label" title="Which browser to use when Wasabi server starts. Chrome usually has the fastest performance">Autolaunch Wasabi in</span> <select data-bind="options:browsers,optionsText:\'n\',optionsValue:\'v\',value:openbrowser"></select> web browser</div>'+
			'<div class="row"><span class="label" title="This folder will hold the analysis library and other data. Click to edit the folder path">Keep Wasabi data in</span> <input id="datadir" type="text" class="hidden" style="margin:0;width:220px" data-bind="value:datadir" title="Click to edit folder path"></div>');
			if(settingsmodel.local=='osxbundle'){
				launchwrap.append('<div class="row"><span class="label" title="Wasabi server will use a new window instead of the Console app to show its status">'+
					'Show server feedback</span> <a class="button toggle" data-bind="css:{on:bundlestart},click:toggle.bind($data,bundlestart)">'+
					'<span class="light"></span><span class="text" data-bind="text:btntxt(bundlestart)"></span></a></div>');
			}
			else if(settingsmodel.local=='linux'){
				launchwrap.append('<div class="row"><span class="label" title="Places a double-clickable shortcut to desktop for easy launching">'+
					'Create desktop launcher</span> <a class="button toggle" data-bind="css:{on:linuxdesktop},click:toggle.bind($data,linuxdesktop)">'+
					'<span class="light"></span><span class="text" data-bind="text:btntxt(linuxdesktop)"></span></a></div>');
			}
		}
			
		var uiwrap = $('<div class="rowwrap">');
		var uirows = $('<div class="row bottombtn">').append(expandtitle({title:'User interface:', desc:'Click for additional settings', target:uiwrap, minh:'34px', maxh:'171px'}).css('display','inline-block'));
		uirows.append(' all animations <a class="button toggle" data-bind="css:{on:allanim},click:toggle.bind($data,allanim)"><span class="light"></span><span class="text" data-bind="text:btntxt(allanim)">'+
			'</span></a><br><span class="label" style="margin-top:10px" title="Disable window animations in case of blurry text">Dialog window animations</span>'+
			'<a class="button toggle" style="margin-top:8px;" data-bind="css:{on:windowanim},click:toggle.bind($data,windowanim)"><span class="light"></span>'+
			'<span class="text" data-bind="text:btntxt(windowanim)"></span></a>');
		uiwrap.append(uirows, '<div class="row bottombtn"><span class="label" title="Click on bottom-left edge of menubar to toggle the display mode">Auto-hide menubar in minimized mode</span>'+
			'<a class="button toggle" data-bind="css:{on:hidebar},click:toggle.bind($data,hidebar)"><span class="light"></span><span class="text" data-bind="text:btntxt(hidebar)"></span></a><br>'+
			'<span style="display:inline-block;margin-top:10px">Compact view of analysis library</span>'+
			'<a class="button toggle" style="margin-top:8px;" data-bind="css:{on:minlib},click:toggle.bind($data,minlib)"><span class="light"></span><span class="text" data-bind="text:btntxt(minlib)">'+
			'</span></a></div>'+
		'<div class="row"><span class="label" title="The analysis sharing links are only useful when Wasabi server is accessible to other computers">Library data sharing links</span>'+
			'<a class="button toggle" data-bind="css:{on:sharelinks},click:toggle.bind($data,sharelinks)"><span class="light"></span><span class="text" data-bind="text:btntxt(sharelinks)"></span></a></div>');
		content.append(launchwrap,uiwrap);
		content.append('<div class="row bottombtn" data-bind="visible:userid"><span class="label" data-bind="attr:{title:\'User ID: \'+userid}">User account</span> <span class="progressline" style="width:150px;margin-left:20px" '+
			'data-bind="visible:datalimit, attr:{title:dataperc()+\' of \'+numbertosize(datalimit,\'byte\')+\' server space in use\'}">'+
			'<span class="bar" data-bind="style:{width:dataperc}"></span><span class="title" data-bind="html:\'Library size: \'+numbertosize(datause(),\'byte\')"></span></span>'+
			'<a class="button toggle" style="margin-top:-2px;padding-bottom:2px" onclick="dialog(\'account\')">Reset</a><br><br>'+
			'<span class="label" title="This web browser remembers and opens your account URL when you go to Wasabi web page. Disable on public computers">Remember me on this computer</span> '+
			'<span class="svgicon share" style="margin-left:35px" title="View/share your account URL" onclick="dialog(\'share\',{url:\''+window.location+'\',nofile:true})">'+svgicon('link')+'</span>'+
			'<a class="button toggle" data-bind="css:{on:keepuser},click:toggle.bind($data,keepuser)"><span class="light"></span><span class="text" data-bind="text:btntxt(keepuser)"></span></a></div>');
				
		var dialogwindow = makewindow('Settings',content,{id:type, icn:type, btn:'OK', closefunc:settingsmodel.saveprefs});
		ko.applyBindings(settingsmodel,dialogwindow[0]);
	}
//translate sequnces
	else if(type=='translate'){
		var windowid = 'importcdna';
		var header = '<div style="width:420px;margin-bottom:20px">Display the sequences as <span class="buttongroup">'+
		'<a class="button left disabled" onclick="translate(\'dna\')" data-bind="css:{pressed:seqtype()==\'dna\'||seqtype()==\'rna\',disabled:!dnasource()}">nucleotides</a>'+
		'<a class="button middle" onclick="translate(\'codons\')" data-bind="css:{pressed:seqtype()==\'codons\',disabled:!dnasource()}">codons</a>'+
		'<a class="button right pressed" onclick="translate(\'protein\')" data-bind="css:{pressed:seqtype()==\'protein\'}">protein</a></span><div>';
		
		var dnaimport = $('<div data-bind="visible:!dnasource()">To backtranslate a protein sequence, Wasabi needs the cDNA sequences used for the protein alignment.<br>'+
		'Drag or select data file(s) with the source cDNA.<br></div>');
		var filedrag = $('<div class="filedrag">Drag cDNA file here</div>');
		var fileroute = window.File && window.FileReader && window.FileList ? 'localread' : 'upload';
		filedrag.bind('dragover',function(evt){ //file drag area
			filedrag.addClass('dragover'); evt.stopPropagation(); evt.preventDefault();
    		evt.originalEvent.dataTransfer.dropEffect = 'copy';
    	}).bind('dragleave',function(evt){
			filedrag.removeClass('dragover'); evt.stopPropagation(); evt.preventDefault();
    	}).bind('drop',function(evt){
    		filedrag.removeClass('dragover'); evt.stopPropagation(); evt.preventDefault();
    		checkfiles(evt.originalEvent.dataTransfer.files,fileroute,windowid);
    	});
		var fileinput = $('<input type="file" multiple style="opacity:0" name="file">');
		var form = $('<form enctype="multipart/form-data" style="position:absolute">');
		fileinput.change(function(){ checkfiles(this.files,fileroute,windowid) });
		var selectbtn = $('<a class="button" style="vertical-align:0">Select files</a>');
		selectbtn.click(function(e){ fileinput.click(); e.preventDefault(); });
		var or = $('<span style="display:inline-block;font-size:18px;"> or </span>');
		form.append(fileinput); filedrag.append(form); dnaimport.append([filedrag,or,selectbtn]);
		var dialogwrap = $('<div id="'+windowid+'" class="popupwrap '+(settingsmodel.windowanim()?'zoomin':'')+'"></div>');
		$("#page").append(dialogwrap);
		var windowdiv = makewindow("Translate sequences",[header,dnaimport],{backfade:false,flipside:'front',icn:'translate.png',btn:'OK'},dialogwrap)[0];
		makewindow("Importing cDNA",[],{backfade:false,flipside:'back',icn:'import.png'},dialogwrap);
		ko.applyBindings(model,windowdiv);
	}
//about/help/contact window
	else if(type=='about'){
		var content = $('<div class="sectiontitle"><span class="label" title="Current version: '+model.version.local+'">About Wasabi</span></div><div class="sectiontext">'+
		'Wasabi is a browser-based application for the visualisation and analysis of multiple alignment molecular sequence data.<br>'+
		'Its multi-platform user interface is built on most recent HTML5 and Javascript standards and it is recommended to use the latest version of '+
		'<a href="http://www.mozilla.org/firefox" target="_blank">Firefox</a>, <a href="http://www.apple.com/safari" target="_blank">Safari</a> '+
		'or <a href="http://www.google.com/chrome" target="_blank">Chrome</a> web browser to run Wasabi. <a href="http://wasabi.biocenter.helsinki.fi" target="_blank">Learn more about Wasabi &gt;&gt;</a></div>'+
		'<div class="sectiontitle"><span>Support</span></div><div class="sectiontext">'+
		'<a class="logo" href="http://www.biocenter.fi" target="_blank"><img src="images/logo_bf.png"></a>'+
		'<a class="logo" href="http://www.biocenter.helsinki.fi/bi" target="_blank"><img src="images/logo_uh.png"></a>'+
		'<a class="logo" href="http://ec.europa.eu/research/mariecurieactions" target="_blank"><img src="images/logo_mc.jpg"></a>'+
		'<a class="logo" href="http://www.helsinki.fi/biocentrum" target="_blank"><img style="height:30px" src="images/logo_bch.gif"></a></div>'+
		'<div class="sectiontitle"><span>Contact</span></div><div class="sectiontext">'+
		'Wasabi is being developed by Andres Veidenberg from the <a href="http://blogs.helsinki.fi/sa-at-bi" target="_blank">Löytynoja lab</a> in Institute of Biotechnology, University of Helsinki.<br>'+
		'You can contact us via our <a href="http://wasabi2.biocenter.helsinki.fi/feedback" target="_blank">feedback webpage &gt;&gt;</a></div>');
		var dialogwindow = makewindow('About',content,{id:type, icn:'info', btn:'OK'});
	}
//welcome dialog for a new user
	else if(type=='newuser'){
		var str = '<div class="sectiontitle"><span>Welcome to Wasabi</span></div>'+
		'Wasabi is a streamlined application for phylogenetic sequence analysis uniting multiple tools and features into a polished user interface. '+
		'<a href="http://wasabi.biocenter.helsinki.fi" target="_blank">Learn more &gt;&gt;</a><br><br>';
		if(options.oldid) str += svgicon('info',{span:true})+'There is no account with ID <span style="color:orange">'+options.oldid+'</span>.<br>';
		str += 'Wasabi created you a new account where to keep your future analyses.<br>'+
		'<a title="'+window.location+'" onclick="dialog(\'share\',{url:\''+window.location+'\',nofile:true})">Current web page address</a> is the key to access your data in the future,<br>so please write it down';
		if(settingsmodel.email) str += ' or <span class="label" title="The e-mail address will only be used for sending the URL">have it sent to</span> <input style="width:180px" type="email" id="usermail" placeholder="your e-mail address">';
		else str += '.';
		if(settingsmodel.userexpire) str+= '<br><span style="color:#888">Note: neglected user accounts will be deleted after '+settingsmodel.userexpire+' days of last visit.</span>'
		str += '<br><input type="checkbox" data-bind="checked:keepuser"> <span class="label" title="This web browser remembers and opens your account URL when you go to Wasabi web page. Disable on public computers"> '+
		'Remember me on this computer</span><br><br>You can now start exploring Wasabi with the provided dataset or use the "Data" menu to import your own.';
		var btn = $('<a class="button">Got it</a>').click(function(){
			if(settingsmodel.email && ~$('#usermail').val().indexOf('@')){ communicate('sendmail',{email:$('#usermail').val()}); }
			if(settingsmodel.keepuser()) localStorage.userid = JSON.stringify(settingsmodel.userid);
			closewindow(this);
		});
		var dialogwindow = makewindow('Welcome',str,{id:type, icn:'info', backfade:true, btn:btn})[0];
		ko.applyBindings(settingsmodel,dialogwindow);
	}
//user account reset window
	else if(type=='account'){
		var content = $('<div>You currently use <span data-bind="text:dataperc"></span> of <span data-bind="html:numbertosize(datalimit,\'byte\')"></span> server disk space allocated<br>to your analysis library.'+
		'<br>Here you can erase the contents of the current library<br>and restart with a new user account.</div>');
		var resetbtn = $('<a class="button red" data-bind="click:function(data,event){communicate(\'rmdir\',{reset:true,id:$data.userid},{btn:event.target,after:function(){window.location.reload()}})}">Reset account</a>');
		var windowdiv = makewindow('Erase user account',content,{id:type, icn:'info', btn:[resetbtn,'Cancel']})[0];
		ko.applyBindings(settingsmodel,windowdiv);
	}
//display local error log content
	else if(type=='errorlog'){
		var errorlog = '<div class="insidediv"><ul class="wrap"><li>'+model.errors().replace(/ \*/g,'</li><li>')+'</li></ul></div>';
		makewindow('Error log',['Wasabi server errors:',errorlog],{id:type, icn:'info', btn:'OK'});
	}
	else if(type=='share'){
		var ckey = navigator.userAgent.match(/Mac/i)? '&#x2318;' : 'crtl';
		var desc = options.nofile? 'to launch Wasabi with your analysis library' : 'or Wasabi import window to display the shared file';
		var content = ['<div>Paste this URL to a web browser address bar<br>'+desc+'.</div><br>'];
		var input = $('<input class="transparent" style="width:350px;padding:0" value="'+options.url+'"></input>');
		setTimeout(function(){input[0].select()},400);
		var email = $('<input style="width:183px" type="email" placeholder="e-mail address">');
		var emailbtn = $('<a class="button square" style="margin-left:3px">Send</a>');
		var sendmail = function(){ if(~email.val().indexOf('@')) communicate('sendmail',{email:email.val(),url:options.url},{btn:emailbtn,restore:true}); }
		emailbtn.click(sendmail);
		content.push(input, '<div class="inputdesc">Press '+ckey+'+C to copy the link to clipboard</div>');
		if(settingsmodel.email) content.push('Share the link: ', email, emailbtn);
		var openbtn = $('<a class="button blue" href="'+options.url+'" target="_blank">Open link</a>');
		makewindow('Share data',content,{icn:'info',btn:['OK',openbtn]});
	}
	
	return false;
}

//submit an alignment job
function sendjob(options){
	var datalimit = settingsmodel.datalimit, joblimit = settingsmodel.joblimit;
	if(datalimit){
		var bplimit = datalimit*100000, liblimit = datalimit*1000000;
		if(model.totalseqlen()>bplimit){
			dialog('notice','Your sequence data size exceeds the server limit of '+numbertosize(bplimit,'bp')+
			'.<br>Please reduce the input dataset size and try again.');
			return false;
		}
		else if(parseInt(settingsmodel.dataperc())>98){
			dialog('notice','Your '+numbertosize(liblimit,'byte')+' server space for your analysis library is full.'+
			'<br>Please delete <a onclick="dialog(\'library\')">some</a> or <a onclick="dialog(\'settings\')">all</a> analyses and try again.');
			return false;
		}
	}
	else if(joblimit && librarymodel.runningjobs()>=joblimit){
		dialog('notice','You already have the maximum of '+joblimit+' jobs running.'+
		'<br>Terminate or wait for a job to finish before launching a new one.');
		return false;
	}
	var alignbtn = options.btn;
	if(!alignbtn.jquery) alignbtn = $(alignbtn);
	alignbtn.unbind('click'); //prevent multiple clicks
	alignbtn.click(closewindow);
	alignbtn.attr('title','Click to close the window');
	
	var optdata = {btn:alignbtn[0]};
	if(options.form) optdata.form = options.form;
	var senddata = {};
	senddata.dots = true;
	senddata.name = options.name||exportmodel.savename()||'PRANK realignment';
	var exportdata = parseexport('fasta',{makeids:true}); //{file:fastafile,nameids:{name:id}}
	senddata.fasta = exportdata.file;
	var idnames = {};
	$.each(exportdata.nameids, function(name,id){ idnames[id] = name; });
	senddata.idnames = idnames;
	if(!$.isEmptyObject(treesvg) && (options.realign || options.ancestral || !options.form['newtree']['checked'])) senddata.newick = parseexport('newick',{tags:true,nameids:exportdata.nameids});
	if(options.realign) senddata.update = true;
	if(librarymodel.openid()) senddata.id = librarymodel.openid();
	if(options.ancestral){ senddata.e = true; if(senddata.id) senddata.writemode = 'overwrite'; }
	if(librarymodel.openparent()) senddata.parentid = librarymodel.openparent();
	var nodeinfo = {};
	$.each(leafnodes,function(name,node){ if(node.ensinfo&&node.type!='ancestral') nodeinfo[name] = node.ensinfo; });
	if(!$.isEmptyObject(nodeinfo)) senddata.nodeinfo = nodeinfo;
	if(!$.isEmptyObject(model.ensinfo())) senddata.ensinfo = model.ensinfo();
	if(model.hiddenlen()) senddata.visiblecols = model.visiblecols();
	
	var successfunc = optdata.success = function(resp){
		alignbtn.html('Job sent');
		try{ var data = JSON.parse(resp); }catch(e){ var data = {}; }
		if(options.ancestral) librarymodel.autoimport = data.id||'';
		else{
			setTimeout(function(){
				if(options.realign) model.treealtered(false);
				closewindow(alignbtn); //close alignment setup winow
			 },2000);
		}
	};
	var errorfunc = function(msg){
		if(!msg) msg = 'No response from server.';
		alignbtn.html('Request failed <span class="svgicon" style="margin-right:-10px">'+svgicon('info')+'</span>');
		alignbtn.attr('title',msg+' Reopen the window to try again.');
	};
	var itemcount = serverdata.library().length;
	optdata.error = function(msg){
		if(~msg.indexOf('response')){ //no reponse. Check if job sent.
			setTimeout(function(){
				var newcount = serverdata.library().length;
				if(newcount>itemcount) successfunc();
				else errorfunc();
			},2000);
		}else{ errorfunc(msg); }
	};
	optdata.timeout = 4000;
	
	communicate('startalign',senddata,optdata);
	return false;
}

//import ensembl data
function ensemblimport(){
	filescontent = {};
	var idformat = ensemblmodel.idformat().url;
	var ensid = ensemblmodel.ensid() || ensemblmodel.idformat().example;
	var ensbtn = document.getElementById('ensbtn');
	var showerror = function(msg){ //display error message next to import button
		ensbtn.innerHTML = 'Error';
		$('#enserror').text(msg||'Unknown error. Try again.'); $('#enserror').fadeIn();
		setTimeout(function(){ ensbtn.innerHTML = 'Import'; $('#enserror').fadeOut(); },4000);
		return false;
	}
	
	if(idformat=='epo'){ //import Ensembl EPO alignment
		var marr = ensid.match(/(\w+):(\d+)\-(\d+)/);
		if(!marr) return showerror('Sequence region in wrong format.');
		var start = parseInt(marr[2]), end = parseInt(marr[3]);
		if(end<start || end-start>10000) return showerror('Max. region length is 10Kb.');
		var epotype = ensemblmodel.epotype().type, eposet = ensemblmodel.eposet(), mask = ensemblmodel.mask;
		var params = {alignment: epotype=='EPO'?'EPO':'EPO_LOW_COVERAGE', set: eposet.name, species: eposet.ref,
			seq_region: marr[1], seq_region_start: start, seq_region_end: end, output_file: ensemblmodel.outname+'.xml',
			db: 'mysql://anonymous@ensembldb.ensembl.org/'+ensemblmodel.dbver, masked_seq: ensemblmodel.maskopt.indexOf(mask)};
		
		ensbtn.innerHTML = '<img src="images/spinner.gif" class="icn"/>';
		
		communicate('startepo',params,{error:function(){ showerror('Wasabi server error. Try again.'); }, success:function(response){
			response = JSON.parse(response);
			if(response.status!='running') showerror('Failed to start EPO alignment fetcher. Try again.');
			else{ //epo fetching started. start polling for progress.
				ensemblmodel.epojob(response.id);
				$(ensbtn).off('click');
				closewindow(ensbtn, function(){ensemblmodel.epojob('')}); //add job cancelling to closebtn
				communicate('getlibrary');
			}
		}});
	}
	else{ //import Ensembl gene or genetree
		var urlopt = idformat=='genetree'? '?content-type=text/x-phyloxml+xml' : '?content-type=application/json';
		if(idformat=='homology'){
			urlopt += ';type='+ensemblmodel.homtype();
			if(ensemblmodel.target()) urlopt += ';target_species='+ensemblmodel.target();
		}
		else if(ensemblmodel.aligned()) urlopt += ';aligned=True';
		urlopt += ';sequence='+ensemblmodel.seqtype();
		var urlstring = ('http://beta.rest.ensembl.org/'+idformat+'/id/'+ensid+urlopt).replace(/ /g,'+');
		var processdata = function(ensdata){
			try{ ensdata = JSON.parse(ensdata); } catch(e){ if(~ensdata.indexOf('BaseHTTP')) return showerror('No response. Check network connectivity.'); }
			if(typeof(ensdata)=='object'){ //JSON => gene homology data
				if(!ensdata.data) return showerror('Data is in unexpected format. Try other options.');
				filescontent[ensid+'.json'] = ensdata;
			} else { //XHTML => genetree data
				if(ensdata.indexOf('phyloxml')==-1) return showerror('Data is in unexpected format. Try other options.');
				var xmlstr = ensdata.substring(ensdata.indexOf('<pre>'),ensdata.indexOf('</pre>')+6);
				xmlstr = $(xmlstr).text().replace(/\s*\n\s*/g,'');
				filescontent[ensid+'.xml'] = xmlstr;
			}
			setTimeout(function(){ parseimport({source:'Ensembl',importbtn:$(ensbtn),importurl:urlstring,ensinfo:{type:idformat,id:ensid}}) },600);
		}
		//reqest data, then process it
		communicate('geturl',{fileurl:urlstring},{success:processdata, btn:ensbtn, btntxt:'Import', restorefunc:ensemblimport, retry:true});
	}
	return false; //for onclick
}

//search for ensembl gene id
function ensemblid(ensdata){
	var ensbtn = document.getElementById('ensidbtn');
	if(!ensdata){ //send request
		if(!ensemblmodel.idspecies()||!ensemblmodel.idname()) return;
		var urlstring = ('http://beta.rest.ensembl.org/xrefs/symbol/'+ensemblmodel.idspecies()+'/'+ensemblmodel.idname()+'?content-type=application/json;object=gene').replace(/ /g,'+');
		communicate('geturl',{fileurl:urlstring},{success:function(data){ensemblid(data)},btn:ensbtn,retry:true,restore:true});
		return false;
	}
	//process data
	try{ ensdata = JSON.parse(ensdata); } catch(e){
		if(~ensdata.indexOf('BaseHTTP')) ensdata = {error:'No response. Check network connectivity.'};
		else ensdata = {error:'No match. Try different search.'};
	}
	if($.isArray(ensdata) && !ensdata.length) ensdata = {error:'No match. Try different search.'};
	if(ensdata.error){
		ensbtn.innerHTML = 'Error';
		$('#enserror').text(ensdata.error||'Unknown error. Try again.'); $('#enserror').fadeIn();
		setTimeout(function(){ ensbtn.innerHTML = 'Search'; $('#enserror').fadeOut(); },4000);
		return false;
	}
	else if(ensdata[0].type == 'gene'){
		ensemblmodel.ensid(ensdata[0].id);
		ensbtn.innerHTML = 'Got ID';
		setTimeout(function(){ ensbtn.innerHTML = 'Search'; },2000);
	}
	return false;
}

/* Validation of files in import dialog */
function checkfiles(filearr,fileroute,windowid,importurl){
	if(!windowid) windowid = 'import';
	var infowindow = $('#'+windowid).length? $('#'+windowid) : makewindow("Importing data",[],{id:windowid,icn:'import.png',btn:false});
	var backside = $('.back',infowindow).length;
	var infodiv = backside? $('.back .windowcontent', infowindow) : $('.windowcontent', infowindow);
	if(!infodiv.length) return;
	var tickimg = $('<img class="icn mall" src="images/tick.png">'); //preload status icons
	var spinimg = $('<img class="icn small" src="images/spinner.gif">');
	var warnimg = $('<img class="icn small" src="images/warning.png">');
	
	// list files //
	var ajaxcalls=[];
	if(!$('ul',infodiv).length){
		var btn = $('<a class="button" style="padding-left:15px">&#x25C0; Back</a>');
		btn.click(function(){
			$.each(ajaxcalls,function(c,call){ if(call.readyState!=4){call.abort()}});
			ajaxcalls = []; //cancel hanging filetransfers
			filescontent = {};
			infowindow.removeClass('finished flipped');
			setTimeout(function(){ infowindow.addClass('finished') },900);
		});
		if(!backside){ btn.text('Cancel'); btn = $('<div class="btndiv" style="text-align:center">').append(btn); }
		var list = $('<ul>');
		$.each(filearr,function(i,file){
			var filesize = file.size ? '<span class="note">('+numbertosize(file.size,'byte')+')</span> ' : '';
			list.append('<li class="file">'+file.name+' '+filesize+'<span class="icon"></span></li>');
		});
		var filestitle = filearr.length? '<b>Files to import:</b><br>' : '';
		infodiv.empty().append(filestitle,list,'<br><span class="errors note"></span><br>',btn);
		if(backside) infowindow.addClass('flipped');
	}
	var errorspan = $('span.errors',infodiv);
	
	var namelist = [];
	var checkprogress = function(){ //check if all files are in filescontent{}
		if(Object.keys(filescontent).length==filearr.length){
        	ajaxcalls = []; checkfiles(namelist,fileroute,windowid,importurl);
        }
	};
	var showerror = function(msg){ errorspan.html('<span class="red">'+msg+'</span>'); };
	
  	// read files in //
  	if(!filearr.length){ showerror('There is nothing to import'); return; }
	if($.isEmptyObject(filescontent)){
		errorspan.text('Loading files...');
		if(fileroute=='upload'||fileroute=='download'){ //via backend server
			if(model.offline()){
  				showerror('This file operation needs a backend server which is currently offline'); return;
  			}
  			$.each(filearr,function(i,file){
  				namelist.push(file.name);
  				var senddata = {};
  				if(fileroute=='upload'){ senddata = {upfile:file} }
  				else if(file.share){
  					var vars = file.share;
  					importurl = file.url;
  					if(~vars.file.indexOf('.xml') && vars.host=='http://'+window.location.host){
  						setTimeout(function(){getfile({id:vars.share,share:file.name,file:vars.file,btn:errorspan})},500);
  						return false;
  					}else{
  						senddata = {fileurl: vars.host+"?type=text&share=true&getlibrary="+vars.share+"&file="+vars.file}
  					}
  				}
  				else if(file.url){
  					senddata = {fileurl:file.url}
  					importurl = file.url;
  				}
  				else{
  					if(file.text) filescontent[file.name] = file.text;
  					checkprogress();
  					return true;
  				}
  				$('li.file span.icon:eq('+i+')',infodiv).empty().append(spinimg);
  				var successfunc = function(data){
        			$('li.file span.icon:eq('+i+')',infodiv).empty();
        			filescontent[file.name] = (data);
        			checkprogress();
        		};
        		var ajaxcall = communicate(fileroute=='upload'?'echofile':'geturl',senddata,{retry:true,error:showerror,success:successfunc});
    			ajaxcalls.push(ajaxcall);
    		});
    	} else if(fileroute=='localread'){ //direct read
    		$.each(filearr,function(i,file){
    			namelist.push(file.name);
    			var reader = new FileReader();  
    			reader.onload = function(evt){
    				filescontent[file.name] = evt.target.result;
    				checkprogress();
    		 	}
    		 	reader.readAsText(file);
    		});
  		}
  		return;
  	}
  
	// check files //
	var iconimg = '', accepted, rejected = [];
	$.each(filescontent,function(name){
		accepted = parseimport({filenames:[name],mode:'check'});
		if(accepted){ iconimg = tickimg.clone(); }
		else{ rejected.push(name); iconimg = warnimg.clone(); }
		$('li.file span.icon:eq('+filearr.indexOf(name)+')',infodiv).empty().append(iconimg);
	});
	
	// import //
	var importfunc = function(){
		errorspan.text('Importing data...');
		setTimeout(function(){ parseimport({source:fileroute,mode:windowid,importurl:importurl,dialog:infowindow}) }, 800);
	};
	if(rejected.length){
		var s = rejected.length>1? 's' : '';
		var msg = '<span class="red">Cannot recognize the "!"-marked file'+s+'.</span><br>Please choose a different file';
		var acceptlen = Object.keys(filescontent).length-rejected.length;
		if(acceptlen>0){
			$.each(rejected,function(r,name){ delete(filescontent[name]); });
			var importbtn = $('<a class="button" style="padding-left:15px">Import</a>');
			importbtn.click(function(){ importbtn.css('color','#999'); importfunc(); });
			infodiv.append(importbtn);
			msg += ',<br> or proceed to import the recognized file'+(acceptlen>1?'s':'');
		}
		errorspan.html(msg+'.');
	}
	else importfunc();
}

//retrieve an analysis datafile from server
function getfile(opt){
	if(opt.btn){
		if(!opt.btn.jquery) opt.btn = $(opt.btn);
		opt.btn.html('<img class="icn" src="images/spinner.gif">');
	}
	var sharestr = opt.share? "&share=true" : "";
    filescontent = {};
    var trycount = 0;
    var filefunc = function(){
	  $.ajax({
		type: "GET",
		url: settingsmodel.userid+"?type=text&getlibrary="+opt.id+"&file="+opt.file+sharestr,
    	dataType: "text",
    	success: function(data){
    		if(!opt.skipimport){ //load and parse filedata for import
    			filescontent[opt.file.replace(/^.*[\\\/]/,'')] = data;
        		setTimeout(function(){ parseimport({source:'import',id:opt.id,importbtn:opt.btn,share:opt.share}) }, 300);
        		if(settingsmodel.keepid){
        			localStorage.openid = JSON.stringify(opt.id);
        			localStorage.openfile = JSON.stringify(opt.file);
        		}
        	}
        	else if(opt.btn) opt.btn.html('<pre>'+data+'</pre>'); //display filecontents inside a div
    	},
    	error: function(xhrobj,status,msg){ 
        	if(!msg && status!="abort"){ //no response. try again
        		if(trycount<1){ trycount++; setTimeout(filefunc,1000); return; }
        		else{ msg = 'No response from server' }
        	}
        	if(opt.btn) opt.btn.html('<span class="label" title="'+msg+'">Failed</span>');
        	else dialog('error','File download error: '+msg);
        },
        xhr: function(){
 			var xhr = $.ajaxSettings.xhr();
 			if(!opt.skipimport && opt.btn){
 				xhr.tick = 1;
 				xhr.addEventListener('progress',function(d){ //listen for file download progress
        			if(d.total && !(xhr.tick%2)){
        				var perc = parseInt(d.loaded/(d.total/100));
        				opt.btn.html('<span class="progressline"><span class="bar" style="width:'+perc+'%">'+
        				'<span class="title">Downloading</span></span></span>');
        			}
        			xhr.tick++;
        		}, false);
        	}
        	return xhr;
  		},
	  });
	}
	if(!opt.skipimport && opt.id){ //library import first needs the metafile
		communicate('getimportmeta',{id:opt.id,share:opt.share},{success:filefunc});
	}
	else{ filefunc(); } //get the requested file
}

//sequence row highlight
var hideborder = false;
function rowborder(data,hiding){
	if(hideborder) clearTimeout(hideborder);
	var rborder = $("#rborder");
	var hidefunc = function(){ rborder.removeClass('opaque'); setTimeout(function(){ rborder.css('display','none') },300); };
	if(hiding=='hide'){ hidefunc(); return; }
	var top = data.y||seqinfo(data).y||0;
	rborder.css('top',top);
	if(rborder.css('display')=='none') rborder.css({display:'block',height:model.boxh()+1});
	rborder.addClass('opaque');
	if(hiding!='keep') hideborder = setTimeout(hidefunc,3000);
}

//translate between sequence types
function translate(totype){
	var fromtype = model.seqtype(), cdna = model.dnasource();
	if(fromtype==totype || !cdna) return;
	var errors = [], nuc, midnuc, codon, aa, step, Tsequences = {}, missinganc = false, tocase;
	var gaps = /[-_.:]+/g;
	var trimgap = function(m){ return m.length%3? m.substring(0,0-m.length%3) : m };
	$.each(sequences,function(name,seqarr){
		if(!cdna[name]){
			if(leafnodes[name] && leafnodes[name].type!='ancestral') errors.push('No cDNA sequence for <span class="grey">'+name+'<span>');
			else missinganc = true;
			return true;
		}
		var curdna = cdna[name].join('').replace(gaps,trimgap);
		var tmpseq = [];
		if(fromtype=='protein'){ //backtranslation
			curdna = curdna.replace(gaps,'');
			var curlen = seqarr.join('').replace(gaps,'').length, seqpos = 0;
			if(curlen*3 != curdna.length){ errors.push('cDNA sequence has wrong length for <span class="grey">'+name+'<span>'); return true; }
			$.each(seqarr,function(col,aa){
				if(gaps.test(aa)){ codon = aa+aa+aa; gaps.lastIndex = 0; }
				else{
					tocase = aa==symbols[aa].masked? 'toLowerCase' : 'toUpperCase';
					codon = curdna.substr(seqpos*3,3)[tocase]();
					seqpos++;
				}
				if(totype=='codons') tmpseq.push(codon); else tmpseq = tmpseq.concat(codon.split(''));
			});
		}
		else if(totype=='protein'){ //translation
			step = fromtype=='codons'? 1 : 3;
			if(step==3 && curdna.length%3){ errors.push('cDNA for <span class="grey">'+name+'</span> doesn\'t divide to 3-base codons'); return true; }
			for(var col=0; col<seqarr.length; col+=step){
				codon = step==3? seqarr.slice(col,col+3).join('') : seqarr[col]; //codon
				midnuc = codon.substr(1,1);
				tocase = letters.indexOf(midnuc)%2? 'toLowerCase' : 'toUpperCase';
				aa = /[-_.:]{3}/.test(codon)? midnuc : alphabet.codons[codon.toUpperCase()]? alphabet.codons[codon.toUpperCase()][tocase]() : '?';
				tmpseq.push(aa);
			}
		}
		else{ //dna<=>codons
			step = fromtype=='codons'? 1 : 3;
			if(step==3 && curdna.length%3){ errors.push('cDNA for <span class="grey">'+name+'</span> doesn\'t divide to 3-base codons'); return true; }
			for(var col=0; col<seqarr.length; col+=step){
				if(step==3) tmpseq.push(seqarr.slice(col,col+3).join('')); //dna=>codon
				else tmpseq = tmpseq.concat(seqarr[col].split('')); //codon=>dna
			}
		}
		Tsequences[name] = tmpseq;
	});
	
	if(errors.length){
		var ul = $('<ul class="wrap">');
		$.each(errors,function(i,error){ 
			if(i>4 && errors.length>6) error = '(not showing '+(errors.length-i)+' other errors)';
			ul.append('<li>'+error+'</li>');
			if(i>4) return false;
		});
		var desc = '';
		if(fromtype=='protein'){ model.dnasource(''); desc = '<br>Please use a cDNA file that matches the current data.'; }
		dialog('error',['Sequence translation failed:',ul,desc]); return;
	}
	var applytrans = function(){
		if($.isEmptyObject(Tsequences)) return false;
		sequences = Tsequences;
		var oldw = model.symbolw();
		model.seqtype(totype);
		var wrate = fromtype=='dna'? (1/3) : totype=='dna'? 3 : 1;
		if(wrate!=1){
			model.minseqlen(Math.round(model.minseqlen()*wrate));
			model.maxseqlen(Math.round(model.maxseqlen()*wrate));
			model.totalseqlen(Math.round(model.totalseqlen()*wrate));
			model.alignlen(Math.round(model.alignlen()*wrate));
		}
		for(var c=model.alignlen(), colarr=[]; c--;) colarr[c] = c;
		model.visiblecols(colarr); //mark all columns as visible
		redraw({zoom:true,refresh:true});
	};
	if(missinganc){
		var applybtn = $('<a class="button">Translate</a>').click(function(){ applytrans(); //$('.closebtn','#transwarn').click();
		closewindow(this);
		});
		var content = 'The cDNA source is missing the ancestral sequences present in current alignment.<br>'+
		'Sequence translation will remove the ancestral sequences. Translate anyway?';
		makewindow("Warning",[content],{id:'transwarn',btn:['Cancel',applybtn],icn:'warning'});
	}
	else applytrans();
}

function seqmenu(selectid){ //generate content for sequence area pop-up menu
	var maskcount = 0, menu = {};
	for(var c=0;c<maskedcols.length;c++){ if(maskedcols[c]) maskcount++; }
	var mode = model.selmode();	
	var actid = model.activeid();
	var selectcount = $('div[id^="selection"]').length;
	var modemenu = {}, curmode = model.selmode();
	$.each(model.selmodes,function(i,mode){
		modemenu[mode] = {click:function(){model.setmode(mode)}, icon:mode};
		if(mode==curmode) modemenu[mode]['class'] = 'active';
	});
		
	if(actid){ //right-click on selection
	  	var target = mode=='default'? 'selection area' : mode;
	  	var maskmenu = {};
	  	maskmenu['Mask '+target] = {click:function(e){maskdata(e,'mask'+target,actid)}, icon:'mask'};
	  	maskmenu['Unmask '+target] = {click:function(e){maskdata(e,'unmask'+target,actid)}, icon:'unmask'};
	  	if(selectcount>1){
	  		maskmenu['Mask all '+selectcount+' selections'] = {click:function(e){maskdata(e,'mask'+target)}, icon:'mask'};
	  		maskmenu['Unmask all '+selectcount+' selections'] = {click:function(e){maskdata(e,'unmask'+target)}, icon:'unmask'};
	  	}
	  	
	  	var hidecolmenu = {};
		if(mode!='rows'){
			hidecolmenu['Collapse columns'] = {click:function(e){hidecolumns(e,actid)}, over:function(){toggleselection('show columns tmp',actid)}, icon:'collapse',
	  		out:function(){toggleselection('hide columns tmp',actid)}};
			if(selectcount>1){
				hidecolmenu['Collapse all selected columns'] = {click:function(e){hidecolumns(e)}, over:function(){toggleselection('show columns tmp')}, icon:'collapse',
	  			out:function(){toggleselection('hide columns tmp')}};
	  		}
		}
		var hiderowmenu = {};
		if(mode!='columns' && model.treesource()){
			hiderowmenu['Collapse rows'] = {click:function(e){hiderows(e,actid)}, over:function(){toggleselection('show rows tmp',actid)}, icon:'collapse',
	  		out:function(){toggleselection('hide rows tmp',actid)}};
			if(selectcount>1){
				hiderowmenu['Collapse all selected rows'] = {click:function(e){hiderows(e)}, over:function(){toggleselection('show rows tmp')}, icon:'collapse',
	  			out:function(){toggleselection('hide rows tmp')}};
	  		}
		}
		
		var clearmenu = {};
		clearmenu['Clear selection'] = {click:function(){clearselection(actid)}, icon:'selection'};
  		if(selectcount>1) clearmenu['Clear all selections'] = {click:function(e){e.stopPropagation(); hidetooltip(); clearselection()}, icon:'selections'};
		
	  	menu = {'Sequence masking':{submenu:maskmenu}, 'Sequence columns':{submenu:hidecolmenu}, 'Sequence rows':{submenu:hiderowmenu}, 'Selections':{submenu:clearmenu}};	
	}else{ //right-click outside of selection
		menu = {'Unmask all sequences':{click:function(e){maskdata(e,'unmaskall')}, icon:'unmask'}};
		if(model.hiddenlen()) menu['Reveal '+model.hiddenlen()+' hidden columns'] = {click:function(){showcolumns('all','hidetip')}, icon:'expand'};
		if(maskcount) menu['Collapse '+maskcount+' masked columns'] = {click:function(e){maskdata(e,'hidemaskedcols')}, icon:'collapse'};
		if(selectcount) menu['Clear '+selectcount+' selections'] = {click:function(e){e.stopPropagation(); hidetooltip(); clearselection()}, icon:'selections'};
	}
	menu['Selection mode'] = {submenu:modemenu, icon:model.selmode(), class:'active'};
	return menu;
}

//check for a new version of a backend service
function checkversion(btn){
	if(btn) btn.innerHTML = 'checking...';
	communicate('geturl',{fileurl:'http://wasabi2.biocenter.helsinki.fi/download/changelog.txt'},
	{success:function(changelog){
		var startind = changelog.indexOf('v.')+2, endind = changelog.indexOf('v.',startind+1);
		if(endind==-1) endind = changelog.length;
		var firstblock = changelog.substring(startind,endind);
		var sepind = firstblock.indexOf('* ');
		var lastver = parseInt(firstblock.substring(0,sepind-1)), lastchange = firstblock.substring(sepind+1);
		if(!isNaN(lastver)){
			model.version.remote(lastver);
			model.version.lastchange = lastchange;
			if(btn){
				if(model.version.local < model.version.remote()){
					btn.innerHTML = '<span style="color:green" title="Click for details">update available</span>';
					settingsmodel.skipversion('');
					btn.onclick = function(){ dialog('jobstatus'); };
				} else { btn.innerHTML = '<span style="color:red" title="Click to recheck">no update</span>'; }
			}
		}
	}});
}

//load startup data from server
function startup(response){
	try{ var data = JSON.parse(response); }catch(e){ model.offline(true); return; }
	var urlstr = window.location.search, urlvars = parseurl();
	var launchact = settingsmodel.onlaunch();
	
	if(data.email) settingsmodel.email = true; //server can send emails
	if(data.userid){
		window.history.pushState('','','/'+data.userid); //update url
		if(data.userid != settingsmodel.userid){
			if(data.newuser){ //new user account created
				settingsmodel.keepuser(true);
				var oldid = settingsmodel.userid;
				setTimeout(function(){ dialog('newuser',{oldid:oldid, newid:data.userid}) }, 2000);
			}
			else if(settingsmodel.keepuser()) localStorage.userid = JSON.stringify(data.userid);
		}
		settingsmodel.userid = data.userid;
	} else { settingsmodel.userid = ''; settingsmodel.keepuser(false); }
	if(data.cpulimit) settingsmodel.jobtimelimit = data.cpulimit;
	if(data.datalimit) settingsmodel.datalimit = parseInt(data.datalimit)*1000000;
	if(data.datause) settingsmodel.datause(parseInt(data.datause));
	if(data.userexpire) settingsmodel.userexpire = data.userexpire;
	if(data.local){ //wire up UI for server-side settings
		settingsmodel.local = true;
		settingsmodel.sharelinks(false);
		if(data.browser){ settingsmodel.openbrowser(data.browser); settingsmodel.openbrowser.sync = true; }
		if(data.datadir){ settingsmodel.datadir(data.datadir); settingsmodel.datadir.sync = true;  }
		if(data.osxbundle){ settingsmodel.local = 'osxbundle'; settingsmodel.bundlestart.sync = true; }
		else if('linuxdesktop' in data){ settingsmodel.local = 'linux'; settingsmodel.linuxdesktop(data.linuxdesktop); settingsmodel.linuxdesktop.sync = true; }
	} else { settingsmodel.checkupdates(false); }
	if(data.autoupdate) settingsmodel.autoupdate = true;
	
	if(settingsmodel.keepzoom() && localStorage.zoomlevel<model.zlevels.length){
		if(localStorage.zoomlevel=='0') localStorage.zoomlevel = '1'; //TMP: workaround for a min. zoomlevel bug
		model.zoomlevel(JSON.parse(localStorage.zoomlevel));
	}

	if(typeof(localStorage.collapse)!='undefined') toggletop(localStorage.collapse);
	
	communicate('getlibrary','',{success: function(){
		if(urlvars.file){
			if(urlvars.share){ //import from library
				if(~urlvars.file.indexOf('.xml')){
					var name = urlvars.name||'shared data';
					getfile({id:urlvars.share, file:urlvars.file, share:name});
				}else{
					dialog('export',{exporturl:settingsmodel.userid+'?type=text&getlibrary='+urlvars.share+'&file='+urlvars.file+'&share=true'});
				}
			} else { getfile({id:'',file:urlvars.file}); } //import local file
		}
		else if(urlvars.url){ //import remote file
			checkfiles([{name:urlvars.url.substr(urlvars.url.lastIndexOf('/')+1),url:urlstr.substr(urlstr.indexOf('url=')+4)}],'download','importurl');
		}
		else if(launchact=='import dialog'){ dialog('import'); } //launch import dialog
		else if(launchact=='demo data'){  getfile({id:'example', file:'out.xml'}); } //or load demo data (default)
		else if(settingsmodel.keepid && localStorage.openid && localStorage.openfile){ //or load last data
			getfile({id:JSON.parse(localStorage.openid), file:JSON.parse(localStorage.openfile)});
		}
	}});

	if(settingsmodel.checkupdates()) checkversion(); //check for updates
	//add epo import opion if server supports it
	if(data.epoimport) ensemblmodel.idformats.push({name:'EPO alignment',url:'epo',example:'13:32906000-32910000'});
}

/* Use AnimationFrame in jQuery animations when supported */
var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
var cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;
(function($){
	var animating;

	function raf(){
		if(animating){ requestAnimationFrame(raf); jQuery.fx.tick(); }
	}

	if(requestAnimationFrame){
		jQuery.fx.timer = function(timer){
			if(timer() && jQuery.timers.push(timer) && !animating){ animating = true; raf(); }
		};
		jQuery.fx.stop = function(){ animating = false; };
	} else {
		requestAnimationFrame = function(callback){ return window.setTimeout(callback, 1000/60); };
		cancelAnimationFrame = function(id){ window.clearTimeout(id); };
	}
}(jQuery));

/* trim() polyfill */
if(!String.prototype.trim){ String.prototype.trim = function(){ return this.replace(/^\s+|\s+$/g, '');}; }

/* Initiation on page load */
$(function(){
	setTimeout(function(){window.scrollTo(0,1)},15); //hides scrollbar in iOS
	
	if(!document.createElement('canvas').getContext){ //old browser => stop loading
		dialog('warning','Your web browser does not support running Wasabi.<br>Please upgrade to a <a onclick="dialog(\'about\')">modern browser</a>.');
		return;
	}

	dom = { seqwindow:$("#seqwindow"), seq:$("#seq"), wrap:$("#wrap"), treewrap:$("#treewrap"), tree:$("#tree"), names:$("#names"), top:$("#top") }; //global ref. of dom elements
	ko.applyBindings(model);
	
	/* set up interface-event bindings */
	$("#treebin div").append(svgicon('trash'));
	var $left = $("#left"), $right = $("#right"), $dragline = $("#namesborderDragline"), $namedragger = $("#namesborderDrag"), draggerpos;
	
	$("#borderDrag").draggable({ //make sequence/tree width resizable
		axis: "x", 
		containment: [150,0,1000,0],
		start: function(e, dragger){ draggerpos = dragger.offset.left-$namedragger.offset().left+5; },
		drag: function(event, dragger) {
			$left.css('width',dragger.offset.left);
			$right.css('left',dragger.offset.left+10);
			$dragline.css('width',dragger.offset.left);
			$namedragger.css('left',dragger.offset.left-draggerpos);
		},
		stop: function(){
			$(window).trigger('resize');
		}
	});
	$namedragger.draggable({ //make names width resizable
		axis: "x", 
		containment: 'parent',
		drag: function(event, dragger) {
			dom.tree.css('right',$left.width()-dragger.offset.left-5);
			dom.names.css('width',$left.width()-dragger.offset.left-5);
		}
	});
	$("#namesborderDrag").hover(
		function(){$("#names").css('border-color','#aaa')},
		function(){$("#names").css('border-color','white')}
	);
	
	$("#names").mouseleave(function(e){ rowborder(e,'hide'); });
	
	//Add mouse click/move listeners to sequence window
	dom.seqwindow.mousedown(function(e){
	 e.preventDefault(); //disable image drag etc.
	 var startpos = {x:e.pageX,y:e.pageY};
	 if(e.pageY>dom.seqwindow.offset().top+30){ //in seq area
	  if(e.which==1 && e.target.tagName!='DIV'){ //act on left mouse button, outside of selections
	  	model.activeid('');
		dom.seqwindow.mousemove(function(evt){ selectionsize(evt,'',startpos); });
		dom.seqwindow.one('mouseup',function(e){
			model.activeid('');
	 		if(e.pageY>dom.seqwindow.offset().top+30){ //in seq area
	  			if(e.which==1 && e.target.tagName!='DIV' && $("div.canvasmenu").length==0){ //outside of selections
	  				var dx = e.pageX-startpos.x; var dy = e.pageY-startpos.y; 
	  				if(Math.sqrt(dx*dx+dy*dy)<10 && !$('#seqmenu').length){ //no drag => higligh row and show position info
	  					var sdata = seqinfo(e);
	  					var bottom = Math.abs(parseInt(dom.seq.css('margin-top')))+dom.seqwindow.innerHeight()-90;
	  					if(model.alignheight()*model.boxh()<bottom) bottom = model.alignheight()*model.boxh()-60;
	  					var arrowtype = sdata.y>bottom? 'bottom' : 'top';
	  					rowborder(sdata);
	  					tooltip(e,sdata.content,{container:"#seq",arrow:arrowtype,target:sdata,shifty:-5});
	  				}
	  			}
	 		}
		});
	  }
	  $('html').one('mouseup',function(){
	 	dom.seqwindow.unbind('mousemove');
	 	if(toolsmodel.prunemode) toolsmodel.markLeafs();
	  });
	 }
	});
	
	var icon = function(type,title){
		title = title? 'title="'+title+'"' : '';
		return '<span class="svgicon" '+title+'>'+svgicon(type)+'</span>';
	}
	
	dom.seqwindow.bind('contextmenu',function(e){ //sequence area right click (pop-up menu)
		e.preventDefault(); //disable default right-click menu
		if($.isEmptyObject(sequences)) return false;
		var target = e.target.id==''? e.target.parentNode : e.target;
		var actid = ~target.id.indexOf('selection')||~target.id.indexOf('cross')? target.id.substr(9) : '';
		model.activeid(actid);
		tooltip(e,'',{data:seqmenu(),id:'seqmenu'}); //show popup menu
	}); //seq. area right-click
	
	function touchHandler(event){ //map touch events to mouseclicks
    	var fingers = event.touches.length, finger = event.changedTouches[0], btn = 0, types = [], 
    	pass = true, t = finger.target, id = t.getAttribute('id'), el = t.tagName, cl = t.className.split(' ')[0];
    	
    	if(fingers>1) return;
    	
    	if(el=='CANVAS' || el=='circle' || cl.indexOf('selection')==0 || cl=='dragger' || cl=='ui-draggable' || cl=='description' || t.parentNode.getAttribute('id')=='ruler') pass = false;
    	
    	if(pass) return;
    	
        switch(event.type){
        	case "touchstart": types = ["mouseover","mousedown"]; break;
        	case "touchmove": types = ["mousemove"]; break;        
        	case "touchend": types = ["mouseup","mouseout"]; break;
        	default: return;
    	}
    	
    	event.preventDefault();
    	
    	if(cl.indexOf('selection')==0 || cl=='description'){
    		if(event.type=="touchstart"){ types.shift(); types.push("contextmenu"); }
    		btn = 2;
    	}
    	
    	var simulateMouse = function(type){
    		var mouseTrigger = document.createEvent("MouseEvent");
    		mouseTrigger.initMouseEvent(type, true, true, window, 1, finger.screenX, finger.screenY, 
        		finger.clientX, finger.clientY, false, false, false, false, btn, null);
			finger.target.dispatchEvent(mouseTrigger);
    	};
    	
    	$.each(types,function(i,type){ simulateMouse(type); });
	}
	
	if('ontouchend' in document){
		document.addEventListener("touchstart", touchHandler, true);
    	document.addEventListener("touchmove", touchHandler, true);
    	document.addEventListener("touchend", touchHandler, true);
    }
	
	//Startup
	settingsmodel.loadprefs();
	var path = window.location.pathname.substring(window.location.pathname.lastIndexOf('/')+1);
	if(path.length && !~path.indexOf('.')){ //launched with account URL
		if(settingsmodel.userid && settingsmodel.userid!=path) settingsmodel.keepuser(false);
		settingsmodel.userid = path;
	}
	var showbuttons = function(){ setTimeout(function(){
		$('#top').removeClass('away');
		$('#startup').fadeOut({complete:function(){ setTimeout(function(){
			$('#left,#right').css('opacity',1);
			$('#namesborderDragline').removeClass('dragmode');
		}, 400); }});
	}, 700); };
	if(~window.location.host.indexOf('localhost')||window.location.protocol=='file:') settingsmodel.sharelinks(false);
	communicate('checkserver','',{success:startup, retry:true, after:showbuttons});
});
