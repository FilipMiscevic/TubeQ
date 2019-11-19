//TubeQ

var NYQUIST_FREQUENCY = 0.5 * 48000; //audioContext.sampleRate;

var STOPPED = false;
var FUNDAMENTAL_FREQ = 2216 / (STOPPED + 1); //f_0 = V/2L for closed, V/4L for open
var OVERTONE = function(n) {
	return STOPPED? FUNDAMENTAL_FREQ * (2*n-1) : FUNDAMENTAL_FREQ * n;
};
var MAX_N = STOPPED? (NYQUIST_FREQUENCY + FUNDAMENTAL_FREQ)/(2 * FUNDAMENTAL_FREQ) : NYQUIST_FREQUENCY / FUNDAMENTAL_FREQ
var Q = 1.0;

// resonance curve to calculate amplitude
function resonanceAmplitude(drivingFreq,resonanceFreq,damping=Q){
	var w = drivingFreq/resonanceFreq;
	//var O = resonanceFreq;
	var Q = damping;

	return 1.0 / Math.sqrt( 1 + Math.pow(Q,2)*Math.pow((w-1.0/w),2) );
};

var allFilters = new Object();

var runOnce = function(){

	var context = new window.AudioContext();
	var mediaElement = document.querySelector('audio');
	var source = context.createMediaElementSource(mediaElement);

	var highShelf = context.createBiquadFilter();
	var lowShelf = context.createBiquadFilter();
	allFilters.highShelf = highShelf;
	allFilters.lowShelf = lowShelf;

	source.connect(highShelf);
	highShelf.connect(lowShelf)

	highShelf.type = "highshelf";
	highShelf.frequency.value = 22000;
	highShelf.gain.value = 0;

	lowShelf.type = "lowshelf";
	lowShelf.frequency.value = 20;
	lowShelf.gain.value = 0;

	//generate peaking filters
	var filter = lowShelf;

	for (var i = 1; i <= MAX_N; i++){
		var newFilter = context.createBiquadFilter();

		newFilter.type = 'peaking';
		newFilter.frequency.value = OVERTONE(i);
		newFilter.gain.value = 0;

		allFilters[ i ] = newFilter;

		filter.connect(newFilter);
		filter = newFilter;
	}

	//fundamental frequency node
	var fundamental = context.createBiquadFilter();
	fundamental.type = 'allpass'
	fundamental.gain.value = 0;
	fundamental.frequency.value = FUNDAMENTAL_FREQ;
	allFilters[ 'fundamental' ] = fundamental;

	filter.connect(fundamental);
	fundamental.connect(context.destination);

	// add event listeners to update individual filter values with values from sliders
	var ranges = document.querySelectorAll('input[type=range]');
	ranges.forEach(function (range) {
		range.value = allFilters[ range.getAttribute('data-filter') ][ range.getAttribute('data-param') ].value;
		range.addEventListener('input', function () {
			allFilters[ this.getAttribute('data-filter') ][ this.getAttribute('data-param') ].value = this.value;
		});
	});

	// add event listeners to multiply the gain when the master gain is altered
	var fundamentalGain = document.querySelector('[data-filter="fundamental"][data-param="gain"]');
	var peakingSliders = document.querySelectorAll('input[data-filter-type="peaking"]');
	fundamentalGain.addEventListener('input', function(){
		peakingSliders.forEach(function(slider){
			slider.value = fundamentalGain.value * resonanceAmplitude(parseInt(allFilters[ slider.getAttribute('data-filter') ][ 'frequency' ].value), FUNDAMENTAL_FREQ, Q);
			allFilters[ slider.getAttribute('data-filter') ][ 'gain' ].value = slider.value;
		});
	});

	// add event listeners to update the peaking filter frequencies when the fundamental frequency is altered
	var fundamentalFreq = document.querySelector('input[data-filter="fundamental"][data-param="frequency"]');
	fundamentalFreq.addEventListener('input', function(){

		FUNDAMENTAL_FREQ = parseInt(fundamentalFreq.value);

		fundamental.frequency.value = FUNDAMENTAL_FREQ;

		peakingSliders.forEach(function(slider){
			// calculate new frequency
			var newFreq = OVERTONE(parseInt(slider.getAttribute('data-filter')));
			// change label
			document.getElementById(slider.getAttribute('data-filter')).innerText = String(newFreq)+" \n20";
			// update node value
			allFilters[ slider.getAttribute('data-filter') ][ 'frequency' ].value = newFreq;
		});
	});

	// set event listener to upload custom audio file
	window.addEventListener('dblclick',function(){
		document.querySelector('input[type="file"]').click();
	}, false);
};


window.onload = function(){
	//create range sliders
	var sliders = document.querySelector('div[id=peaking-sliders]');
	for (var i = 1; i <= MAX_N; i++) {

		var f = OVERTONE(i);

		var slider = document.createElement('div');
		slider.setAttribute('class','range-slider');

		var span1 = document.createElement('span');
		span1.setAttribute('class','scope scope-max');
		span1.setAttribute('id',i);
		span1.innerText = String(f)+" \n20";

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
	}

	window.addEventListener('click', function(){
		runOnce();
		// display welcome message
		alert("Welcome to TubeQ, a tube distortion simulator prototype! \
		Double click anywhere to upload your own sound file, \
		or press play to hear the sample provided.");
	}
	, {once:true});
	
	document.querySelector('input[type="file"]').addEventListener('change', function(){
		var file = this.files[0],
		fileURL = window.webkitURL.createObjectURL(file);
		/*
		console.log(file);
		console.log('File name: '+file.name);
		console.log('File type: '+file.type);
		console.log('File BlobURL: '+ fileURL); 
		*/
		document.getElementById('media').src = fileURL;
	});
};