let cephForm = document.getElementById('ceph-form');

function getUsableStorage(sets, replicas) {
  console.log('getUsableStorage(', sets, ', ', replicas, ')');

  if(sets.reduce((count, set) => count + set.count, 0) < replicas) {
    console.log('Too few nodes, returning 0');
    return 0;
  }

  // Compute total raw (= not taking replication into account)
  let totalRaw = sets.reduce((total, set) => total + set.count * set.size, 0);

  for(let set of sets) {
    set.available = set.size;
  }

  // Compute max raw storage used
  let storage = 0;
  for(var iter = 0; true; ++iter) {
    // Sort sets by decreasing individual remaining capacity
    sets.sort((a, b) => b.available - a.available);
    console.log('Sets: ', sets);

    // Find out how many nodes to use up
    let howManyNodes = 0;
    let howManySets = 0
    while(howManySets < sets.length && (howManyNodes < replicas || sets[howManySets - 1].available == sets[howManySets].available)) {
      howManyNodes += sets[howManySets].count;
      howManySets++;
    }

    // Increase used storage and decrease capacity
    let amount = sets[howManySets - 1].available;
    if(sets.length > howManySets) {
      amount -= sets[howManySets].available;
    }
    if(amount <= 0) {
      break;
    }
    console.log('Using ', amount, ' from ', howManyNodes, ' nodes');
    storage += amount * howManyNodes;
    for(var i = 0; i < howManySets; ++i) {
      sets[i].available -= amount;
    }
    console.log(sets);

    if(iter === 100) {
      console.error('Infinite loop detected');
      throw new Error('Infinite loop detected');
    }
  }

  console.log('Done, storage=', storage);
  return storage;
}

function computeResult() {
  try {
    // Get input
    let entries = cephForm.elements['nodes'].value;
    entries = entries.split(/\s+/);
    entries = entries.filter(e => e.length > 0);

    // Build list of sets of sets as {count, size}
    let count = 1;
    let sets = [];
    for(let i = 0; i < entries.length; ++i) {
      let e = entries[i];
      if(e.length >= 2 && e[e.length - 1] == 'x' && i != entries.length - 1) {
        count = parseInt(e.substring(0, e.length - 1), 10);
        if(isNaN(count)) {
          throw new Error('Invalid count');
        }
      } else {
        let size = parseInt(e, 10);
        if(isNaN(size)) {
          throw new Error('Invalid capacity');
        }
        sets.push({count: count, size: size});
        count = 1;
      }
    }

    // Compute total raw (= not taking replication into account)
    let totalRaw = sets.reduce((total, set) => total + set.count * set.size, 0);

    let size, redundancy;
    if(cephForm.elements['mode'].value === 'replicated') {
      let replicas = parseInt(cephForm.elements['size-replicated'].value, 10);
      if(isNaN(replicas)) {
        throw new Error('Invalid size');
      }
      // replicated 3 -> erasure-coded 1+2
      size = 1;
      redundancy = replicas - 1;
    } else {
      size = parseInt(cephForm.elements['size-erasure'].value, 10);
      if(isNaN(size)) {
        throw new Error('Invalid size');
      }
      redundancy = parseInt(cephForm.elements['size-erasure-redundancy'].value, 10);
      if(isNaN(redundancy)) {
        throw new Error('Invalid redundancy');
      }
    }

    let result = getUsableStorage(sets, size + redundancy);
    let summary = (
      'Maximum data stored: ' + (result * size / (size + redundancy))
      + '<br>raw: ' + result
      + '<br>usage: ' + (100.0 * result / totalRaw) + '%'
    );
    let details = '';
    if(result > 0) {
      details = (
        '<br><br>Maximum node usage:'
        + '<ul>'
        + sets.map((set) => (
          '<li>'
          + ((set.count !== 1)?set.count + 'x ':'')
          + (set.size - set.available) + '/' + set.size
          + '</li>'
        )).join('')
        + '</ul>'
      );
    }
    document.getElementById('results').innerHTML = summary + details;
  } catch(error) {
    document.getElementById('results').innerText = error.message;
  }
}

function modeChanged() {
  console.log('Mode changed');
  if(cephForm.elements['mode'].value === 'replicated') {
    document.getElementById('size-replicated').style.display = '';
    document.getElementById('size-erasure').style.display = 'none';
  } else {
    document.getElementById('size-replicated').style.display = 'none';
    document.getElementById('size-erasure').style.display = '';
  }
  computeResult();
}
[].forEach.call(cephForm.elements['mode'], e => e.addEventListener('change', modeChanged));
modeChanged();

cephForm.elements['size-replicated'].addEventListener('change', computeResult);
cephForm.elements['size-erasure'].addEventListener('change', computeResult);
cephForm.elements['size-erasure-redundancy'].addEventListener('change', computeResult);
cephForm.elements['nodes'].addEventListener('change', computeResult);
computeResult();
