class TubeQ {

	constructor(source,fundamentalFreq=2216,stopped=false){
		this.source = source;
		this.context = source.context;
		this.Q = 1.0;
		this.MAX_SLIDERS = 10;
		this.NYQUIST_FREQUENCY = 0.5 * this.context.sampleRate;


		this.STOPPED = stopped;
		this.FUNDAMENTAL_FREQ = fundamentalFreq / (this.STOPPED + 1); //f_0 = V/2L for closed, V/4L for open, to theoretically hold V/L constant
		this.MAX_N = Math.min(this.MAX_SLIDERS,Math.floor(this.STOPPED? (this.NYQUIST_FREQUENCY + this.FUNDAMENTAL_FREQ)/(2 * this.FUNDAMENTAL_FREQ) : this.NYQUIST_FREQUENCY / this.FUNDAMENTAL_FREQ));
		
		this.allFilters = new Object();

		var highShelf= this.context.createBiquadFilter();
		var lowShelf = this.context.createBiquadFilter();
		this.allFilters.highShelf = highShelf;
		this.allFilters.lowShelf = lowShelf;

		source.connect(highShelf);
		highShelf.connect(lowShelf);

		highShelf.type = "highshelf";
		highShelf.frequency.value = 22000;
		highShelf.gain.value = 0;

		lowShelf.type = "lowshelf";
		lowShelf.frequency.value = 20;
		lowShelf.gain.value = 0;

		var filter = lowShelf;
		for (var i = 1; i <= this.MAX_N; i++){
			var newFilter = this.context.createBiquadFilter();

			newFilter.type = 'peaking';
			newFilter.frequency.value = this.overtone(i);
			newFilter.gain.value = 0;

			this.allFilters[ i ] = newFilter;

			filter.connect(newFilter);
			filter = newFilter;
		}

		//fundamental frequency node
		var fundamental  = this.context.createBiquadFilter();
		fundamental.type = 'allpass'
		fundamental.gain.value = 0;
		fundamental.frequency.value = this.FUNDAMENTAL_FREQ;
		this.allFilters[ 'fundamental' ] = fundamental;

		filter.connect(fundamental);
	};

	// resonance curve to calculate amplitude
	resonanceAmplitude(drivingFreq,damping=this.Q){
		// TODO: make a function work with the overtone number
		if (drivingFreq==0){
			console.log('WARNING: drivingFreq is 0, gain would be NaN');
			return 0;
		};
		var w = drivingFreq/this.FUNDAMENTAL_FREQ;
		//var O = resonanceFreq;
		var Q = damping;
		return 1.0 / Math.sqrt( 1 + Math.pow(Q,2) * Math.pow((w-1.0/w),2) );
	};

	// calculate nth overtone
	overtone (n) {
		return Math.min(this.NYQUIST_FREQUENCY, this.STOPPED? this.FUNDAMENTAL_FREQ * (2*n-1) : this.FUNDAMENTAL_FREQ * n);
	};

	connect(destination){
		this.allFilters.fundamental.disconnect();
		this.allFilters.fundamental.connect(destination);
	};

	disconnect(){
		this.allFilters.fundamental.disconnect();
		this.source.disconnect(this.allFilters.highShelf);
	};

	setFundamentalFrequency(newFreq,stopped=null){
		if (stopped != null) this.STOPPED = Boolean(stopped);
		this.FUNDAMENTAL_FREQ = newFreq / (this.STOPPED + 1);
		this.allFilters.fundamental.frequency.value = this.FUNDAMENTAL_FREQ;

		for (var i=1; i <= this.MAX_N; i++){
			this.allFilters[i].frequency.value = this.overtone(i);
		};
		return this.FUNDAMENTAL_FREQ;
	};

	setGain(gain){
		for (var i = 1; i <= this.MAX_N; i++){
			//console.log('GAIN,NGAIN',this.allFilters[i].gain.value,1.0 * gain * this.resonanceAmplitude(this.allFilters[i].frequency.value));
			this.allFilters[i].gain.value = 1.0 * gain * this.resonanceAmplitude(this.allFilters[i].frequency.value);
		};
	};

	setStop(bool){
		this.setFundamentalFrequency(this.FUNDAMENTAL_FREQ * (1 + this.STOPPED), bool);
	};

	toggleStop(){
		this.setFundamentalFrequency(this.FUNDAMENTAL_FREQ * (1 + this.STOPPED), !this.STOPPED);
	};
};


function createSliders(n,id){

	//create range sliders
	var sliders = document.querySelector('div[id='+id+']');
	for (var i = 1; i <= n; i++) {
		var slider = document.createElement('div');
		slider.setAttribute('class','range-slider');

		var span1 = document.createElement('span');
		span1.setAttribute('class','scope scope-max');
		span1.setAttribute('id',i);
		span1.innerText = " \n20";

		var input = document.createElement('input')
		input.setAttribute('type','range');
		input.setAttribute('class','vertical');
		input.setAttribute('min','-20');
		input.setAttribute('max','20');
		input.setAttribute('value','0');
		input.setAttribute('data-filter', i);
		input.setAttribute('data-filter-type', 'peaking');
		input.setAttribute('data-param','gain');

		var span2 = document.createElement('span');
		span2.setAttribute('class','scope scope-min');
		span2.innerText = -20;

		var span3 = document.createElement('span');
		span3.setAttribute('class','param');
		span3.innerText = 'dB';

		slider.append(span1);
		slider.append(input);
		slider.append(span2);
		slider.append(span3);
		sliders.append(slider);	
	};
}


function bindSliders(tube,id = 'peaking-sliders1'){
	// add event listeners to update individual filter values with values from sliders
	var ranges = document.querySelectorAll('input[type=range]');
	ranges.forEach(function (range) {
		console.log(range.parentNode.parentNode.getAttribute('id'),id);
		if (range.parentNode.parentNode.getAttribute('id') == id){
		range.value = tube.allFilters[ range.getAttribute('data-filter') ][ range.getAttribute('data-param') ].value;
		range.addEventListener('input', function () {
			tube.allFilters[ this.getAttribute('data-filter') ][ this.getAttribute('data-param') ].value = this.value;
		});
	}

	});

	// add event listeners to multiply the gain when the master gain is altered
	var fundamentalGain = document.querySelector('[data-filter="fundamental"][data-param="gain"]');
	var peakingSliders = document.querySelectorAll('input[data-filter-type="peaking"]');
	
	peakingSliders.forEach(function(slider){
		// change label
		var newFreq = tube.allFilters[parseInt(slider.getAttribute('data-filter'))].frequency.value;
		document.getElementById(slider.getAttribute('data-filter')).innerText = String(newFreq)+" \n20";
	});

	fundamentalGain.addEventListener('input', function(){


		tube.setGain(fundamentalGain.value);

		peakingSliders.forEach(function(slider){

		//console.log(slider.parentNode.parentNode.getAttribute('id'));
		var sliderSet = Boolean(slider.parentNode.parentNode.getAttribute('id'))? slider.parentNode.parentNode.getAttribute('id')[slider.parentNode.parentNode.getAttribute('id').length-1]: 0;

		if (parseInt(sliderSet) == 1){
			//console.log('tube1:',tube.allFilters[ slider.getAttribute('data-filter') ][ 'gain' ].value);
			slider.value = tube.allFilters[ slider.getAttribute('data-filter') ][ 'gain' ].value;

		}if(parseInt(sliderSet) == 2){
			//console.log('tube2:',tube2.allFilters[ slider.getAttribute('data-filter') ][ 'gain' ].value);
			//slider.value =tube2.allFilters[ slider.getAttribute('data-filter') ][ 'gain' ].value;
		}
	})

	});

	// add event listeners to update the peaking filter frequencies when the fundamental frequency is altered
	var fundamentalFreq = document.querySelector('input[data-filter="fundamental"][data-param="frequency"]');
	fundamentalFreq.addEventListener('input', function(){
		
		// update node value
		tube.setFundamentalFrequency(parseInt(fundamentalFreq.value));

		peakingSliders.forEach(function(slider){
			// change label
			var newFreq = tube.allFilters[parseInt(slider.getAttribute('data-filter'))].frequency.value;
			document.getElementById(slider.getAttribute('data-filter')).innerText = String(newFreq)+" \n20";
		});
	});

	// add keyup event for spacebar stop toggle
	window.onkeyup = function(event){
		if (event.key == " "){
			tube.toggleStop();
			peakingSliders.forEach(function(slider){
			// change label
			var newFreq = tube.allFilters[parseInt(slider.getAttribute('data-filter'))].frequency.value;
			document.getElementById(slider.getAttribute('data-filter')).innerText = String(newFreq)+" \n20";
		});
		};
	};
};

var audioContext; 
var streamNode;
var source; 
var tube;

function loadBuffer(url){
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';
	request.onload = function() {
			var audioData = request.response;

				audioContext.decodeAudioData(audioData, function(buffer) {
				source.buffer = buffer;
				source.loop = true;
			    source.start(0);

			    streamNode = audioContext.createMediaStreamDestination();
				audioElem = document.querySelector('audio');
			    audioElem.srcObject = streamNode.stream;

			    tube = new TubeQ(source);
				bindSliders(tube,'peaking-sliders1');
				tube.connect(streamNode);
			},
			function(e){ console.log("Could not decode audiostream: " + e.err); });
		}
		request.send();
}

// initiate audiocontext on user interaction
window.addEventListener('click', 
	function(){

	alert("Welcome to TubeQ, a tube distortion simulator prototype! \
	Double click anywhere to upload your own sound file, \
	or press play to hear the sample provided.");

	audioContext = new AudioContext();
	source = audioContext.createBufferSource();
	loadBuffer('audio.flac');
	
	},
		{once:true}
	);

window.onload = function(){
	
	createSliders(10,'peaking-sliders1');

	document.querySelector('input[type="file"]').addEventListener('change', function(){
		var file = this.files[0],
		fileURL = window.webkitURL.createObjectURL(file);
		document.getElementById('media').src = fileURL;
	});
};

//TODO: fix
window.ondblclick = function(){
	//document.querySelector('input[type="file"]').click();
};