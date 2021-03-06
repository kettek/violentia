var canvas, e_drop, e_filetree;
var crop_sprites;
var e_display, canvas, ctx;
var e_drop;
var e_filetree, e_outtree;
var e_log;

function gogogo() {
  e_display = document.getElementById('display');
  canvas = document.getElementById('canvas');
  e_drop = document.getElementById('drop');
  e_filetree = document.getElementById('filetree');
  e_outtree = document.getElementById('outtree');
  e_log = document.getElementById('log');

  ctx = canvas.getContext('2d');

  var pairs = [];
  var filetree = new Branch(e_filetree, "Input Files");

  /* ================ Canvas ================ */
  function handleResize() {
    var win = window.getComputedStyle(e_display, null);
    var d_w = parseInt(win.getPropertyValue('width'));
    var d_h = parseInt(win.getPropertyValue('height'));
  }
  window.addEventListener('resize', handleResize);
  handleResize();
  /* ================ Etc ================ */
  function doLog(msg) {
    var emsg = document.createElement('div');
    emsg.innerHTML = new Date().getTime() + ': ' + msg;
    e_log.appendChild(emsg);
    e_log.scrollTop = Math.max(e_log.scrollHeight, e_log.clientHeight) - e_log.clientHeight;
  }

  /* ================ Pack Grid ================ */
  function PackGrid() {
    var width = 0;
    var height = 0;
    var grid = [];

    function checkGridSpace(x, y) {
      if (x >= width || x < 0 || y >= height || y < 0) return false;
      if (grid[x][y].open) return true;
      return false;
    }
    function findGridSpace(w, h) {
      for (var gx = 0; gx < width; gx++) {
        for (var gy = 0; gy < height; gy++) {
          var okay = true;
          for (var wx = 0; wx <= w; wx++) {
            if (!(okay = checkGridSpace(gx+wx, gy))) break;
            for (var wy = 0; wy <= h; wy++) {
              if (!(okay = checkGridSpace(gx+wx, gy+wy))) break;
            }
            if (!okay) break;
          }
          if (okay) {
            return {x: gx, y: gy, w: w, h: h};
          }
        } // end gy
      } // end gx
      return null;
    }
    function growGrid(gx, gy) {
      for (var grow_x = 0; grow_x < gx; grow_x++) {
        grid[width+grow_x] = [];
        for (var y = 0; y < height; y++) {
          grid[width+grow_x][y] = {open: true};
        }
      }
      width += gx;

      for (var grow_y = 0; grow_y < gy; grow_y++) {
        for (var x = 0; x < width; x++) {
          grid[x][height+grow_y] = {open: true};
        }
      }
      height += gy;
    }
    function closeGridSpaces(gx, gy, gw, gh) {
      for (var x = gx; x < gx+gw; x++) {
        for (var y = gy; y < gy+gh; y++) {
          grid[x][y].open = false;
        }
      }
    }
    
    this.checkGridSpace = checkGridSpace;
    this.findGridSpace = findGridSpace;
    this.growGrid = growGrid;
    this.closeGridSpaces = closeGridSpaces;
    this.getWidth = function() { return width; };
    this.getHeight = function() { return height; };
  }
  /* ================ Cropping ================ */
  function getCroppedSize(f) {
    canvas.width = f.w;
    canvas.height = f.h;
    ctx.drawImage(pairs[f.i].image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);

    var idat = ctx.getImageData(0, 0, f.w, f.h);
    var pixels = idat.data;
    var x0 = -1, x1 = -1, y0 = -1, y1 = -1;
    for (var i = 0, n = pixels.length; i < n; i +=4) {
      var p = i / 4;
      var x = p % canvas.width;
      var y = Math.floor(p / canvas.width);
      if (pixels[i+3] > 0) {
        if (x0 == -1 || x < x0) x0 = x;
        if (x1 == -1 || x > x1) x1 = x;
        if (y0 == -1 || y < y0) y0 = y;
        if (y1 == -1 || y > y1) y1 = y;
      }
    }
    x1++;
    y1++;

    return {xmin:x0, xmax:x1, ymin:y0, ymax:y1};
  }
  /* ================ Frame reformat ================ */
  var mega_json = {};
  // This function creates a new large-format JSON file from the JSON files in pairs and their corresponding packed frames.
  function reformatFrames() {
    mega_json = {};
    for (i in pairs) {
      if (!pairs[i].json) continue;
      var data = cloneObject(pairs[i].json);
      for (a in data.A) {
        if (data.A[a].C) {
          // delete rows/columns settings as we created explicit frames from them
          if (data.A[a].C.r) delete data.A[a].C.r;
          if (data.A[a].C.c) delete data.A[a].C.c;
          if (data.A[a].C.T) delete data.A[a].C.T;
        }
        for (s in data.A[a].S) {
          var S = data.A[a].S[s];
          if (S.C) {
            if (S.C.r) delete S.C.r;
            if (S.C.c) delete S.C.c;
            if (S.C.T) delete S.C.T;
          }
          S.F = [];
        }
      }
      // FIXME: this be highly inefficient
      for (f in pending_frames) {
        if (pending_frames[f].i != i) continue;
        var a = pending_frames[f].a;
        var s = pending_frames[f].s;
        if (!data.A[a]) data.A[a] = {};
        if (!data.A[a].S) data.A[a].S = {};
        if (!data.A[a].S[s]) data.A[a].S[s] = {};
        var S = data.A[a].S[s];
        if (!S.F) S.F = [];
        data.A[a].S[s].F[pending_frames[f].f] = {};
        if (typeof pending_frames[f].space.x !== 'undefined') S.F[pending_frames[f].f].x = pending_frames[f].space.x;
        if (typeof pending_frames[f].space.y !== 'undefined') S.F[pending_frames[f].f].y = pending_frames[f].space.y;
        if (typeof pending_frames[f].space.w !== 'undefined') S.F[pending_frames[f].f].w = pending_frames[f].space.w;
        if (typeof pending_frames[f].space.h !== 'undefined') S.F[pending_frames[f].f].h = pending_frames[f].space.h;
        if (typeof pending_frames[f].t !== 'undefined') S.F[pending_frames[f].f].t = pending_frames[f].t;
        // only provide offsets if cropping did occur
        if (crop_sprites) {
          if (!S.P) S.P = {};
          /* NOTE: this is unneeded, as "offset" provides this already
          // modify all points by our offset
          for (p in S.P) {
            for (pf in S.P[p]) {
              S.P[p][pf][0] += pending_frames[f].x_offset;
              S.P[p][pf][1] += pending_frames[f].y_offset;
            }
          }
          */
          if (!S.P["offset"]) S.P["offset"] = [];
          S.P["offset"][pending_frames[f].f] = [pending_frames[f].x_offset,pending_frames[f].y_offset];
        }
      }
      mega_json[pairs[i].name] = data;
    }
    console.log(mega_json);
  }
  /* ================ Packing ================ */
  var all_frames = [];
  var pending_frames = [];
  var optimized_frames = [];
  function packImages() {
    collectFrames();
    combineFrames();
    canvas.toBlob(function(blob) {
      doLog('Generated PNG is '+blob.size+' bytes');
      var size = 0;
      for (i in pairs) {
        size += pairs[i].image_size;
      }
      doLog(' difference: '+(size > blob.size ? '' : '+')+(blob.size-size));
    });
    reformatFrames();
  }
  document.getElementById('pack').addEventListener('click', packImages);
  function combineFrames() {
    var grid = new PackGrid();
    var width = 0;
    var height = 0;
    var x = 0;
    var y = 0;
    pending_frames = all_frames.slice(0);
    for (var i = 0; i < pending_frames.length; i++) {
      var f = pending_frames[i];

      var w, h;
      pending_frames[i].x_offset = 0;
      pending_frames[i].y_offset = 0;
      if (crop_sprites) {
        var c = getCroppedSize(pending_frames[i]);
        pending_frames[i].x_offset = c.xmin;
        pending_frames[i].y_offset = c.ymin;
        pending_frames[i].c = c;
        w = (c.xmax-c.xmin) || 1;
        h = (c.ymax-c.ymin) || 1;
      } else {
        w = pending_frames[i].w;
        h = pending_frames[i].h;
      }

      var space = null;
      while (!(space = grid.findGridSpace(w, h))) {
        grid.growGrid(1,1);
      }
      grid.closeGridSpaces(space.x, space.y, space.w, space.h);
      pending_frames[i].space = space;
    }
    canvas.width = grid.getWidth();
    canvas.height = grid.getHeight();
    for (i = 0; i < pending_frames.length; i++) {
      var f, c, x, y, w, h;
      f = pending_frames[i];
      if (crop_sprites) {
        c = f.c;
        x = f.x+c.xmin;
        y = f.y+c.ymin;
        w = (c.xmax-c.xmin) || 1;
        h = (c.ymax-c.ymin) || 1;
      } else {
        x = f.x;
        y = f.y;
        w = f.w;
        h = f.h;
      }
      ctx.drawImage(pairs[f.i].image, x, y, w, h, f.space.x, f.space.y, f.space.w, f.space.h);
      // ****
    }
  }
  function collectFrames() {
    all_frames = [];
    for (i in pairs) {
      if (!pairs[i].json) {
        doLog(i+' has no JSON, skipping');
        continue;
      }
      doLog('analyzing ' + pairs[i].name + '...');
      var frames = getFrames(pairs[i].json, i);
      doLog('... found ' + frames.length + ' frames');
      all_frames = all_frames.concat(frames);
    }
    doLog('Total frames: ' + all_frames.length);
  }
  function getFrames(json, i) {
    if (!json) return [];
    var sprites = [];
    json.C = json.C || {};
    var ox = json.C.x || 0, oy = json.C.y || 0;
    var ow = json.C.w || 0, oh = json.C.h || 0;
    for (a in json.A) {
      var A = json.A[a];
      A.C = A.C || {};
      ax = A.C.x || ox, ay = A.C.y || oy;
      aw = A.C.w || ow, ah = A.C.h || oh;
      if (A.C.r && A.C.c) {
        for (var y = 0; y < A.C.r; y++) {
          for (var x = 0; x < A.C.c; x++) {
            sprites.push({x: ax+x*aw, y: ay+y*ah, w: aw, h: ah, a: a, s: 0, f: (y*A.C.c)+x, i: i});
          }
        }
      }
      for (s in A.S) {
        var S = A.S[s];
        S.C = S.C || {};
        sx = S.C.x || ax, sy = S.C.y || ay;
        sw = S.C.w || aw, sh = S.C.h || ah;
        for (f in S.F) {
          var F = S.F[f];
          var fx, fy, fw, fh;
          if (F.constructor === Array) {
            fx = F[0] || sx, fy = F[1] || sy;
            fw = F[2] || sw, fh = F[3] || sh;
          } else {
            fx = F.x || sx, fy = F.y || sy;
            fw = F.w || sw, fh = F.h || sh;
          }
          var frame = {x: parseInt(fx), y: parseInt(fy), w: parseInt(fw), h: parseInt(fh), a: a, s: s, f: parseInt(f), i: i}
          if (typeof F.T !== 'undefined') frame.t = parseInt(F.t);
          sprites.push(frame);
        }
        if (S.C.r && S.C.c) {
          for (var y = 0; y < S.C.r; y++) {
            for (var x = 0; x < S.C.c; x++) {
              sprites.push({x: sx+x*sw, y: sy+y*sh, w: sw, h: sh, a: a, s: s, f: S.F.length+(y*S.C.c)+x, i: i});
            }
          }
        }
      }
    }
    return sprites;
  }
  /* ================ Pair Access ================ */
  function acquirePairIndex(name) {
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].name == name) return i;
    }
    pairs.push({name: name, image: null, data: null});
    return pairs.length-1;
  }
  function getPairIndex(name) {
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].name == name) return i;
    }
    return -1;
  }
  function deletePair(name) {
    var id = -1;
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i].name == name) {
        id = i;
        break;
      }
    }
    if (id == -1) return;
    pairs.splice(id, 1);
  }

  /* ================ Drop Handling ================ */
  function setupBranch(branch) {
    if (!branch.getInput('delete')) {
      branch.addInput("button", "delete", '-', function(cb) {
        deletePair(branch.getText());
        branch.implode();
      });
      branch.addInput('button', 'up', '^', function(cb) {
        var pid = getPairIndex(branch.getText());
        console.log(pid);
        if (pid == 0) return;
        var pair = pairs.splice(pid, 1)[0];
        pairs.splice(pid-1, 0, pair);
        branch.moveUp();
      });
      branch.addInput('button', 'down', 'v', function(cb) {
        var pid = getPairIndex(branch.getText());
        console.log(pid);
        if (pid == pairs.length-1) return;
        var pair = pairs.splice(pid, 1)[0];
        pairs.splice(pid+1, 0, pair);
        branch.moveDown();
      });
    }
  }
  function addImage(name, data) {
    var branch = filetree.getBranch(name) || filetree.addBranch(name);
    var ibranch = branch.getBranch('image') || branch.addBranch('image');
    ibranch.addText(' '+pairs[getPairIndex(name)].image_size+' bytes');
    setupBranch(branch);
    doLog('added ' + name + ' image');
  }
  function addJSON(name, data) {
    var branch = filetree.getBranch(name) || filetree.addBranch(name);
    var jbranch = branch.getBranch('json') || branch.addBranch('json');
    jbranch.addText(' '+pairs[getPairIndex(name)].data_size+' bytes');
    setupBranch(branch);
    doLog('added ' + name + ' JSON');
  }
  function loadFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (typeof FileReader !== 'undefined') {
        var reader = new FileReader;
        if (file.type.indexOf('image') != -1) {
          (function(f){
            var fname = f.substring(0,f.lastIndexOf('.'));
            var pid = acquirePairIndex(fname);
            pairs[pid].image_size = file.size;
            reader.onload = function(evt) {
              pairs[pid].image = new Image();
              pairs[pid].image.onload = function() {
                addImage(fname);
              };
              pairs[pid].image.src = evt.target.result;
            };
            reader.readAsDataURL(file);
          })(file.name);
        } else {
          (function(f){
            var fname = f.substring(0,f.lastIndexOf('.'));
            var pid = acquirePairIndex(fname);
            pairs[pid].data_size = file.size;
            reader.onload = function(evt) {
              pairs[pid].json = eval('({'+evt.target.result+'})');
              addJSON(fname);
            };
            reader.readAsText(file);
          })(file.name);
        }
      }
    }
  }
  // set up dropping
  document.getElementById('drop').addEventListener('drop', function(evt) {
    evt.preventDefault();
    loadFiles(evt.dataTransfer.files);
  }, false);
  /* ================ Element hooks ================ */
  var e_crop_sprites = document.getElementById('crop_sprites');
  e_crop_sprites.addEventListener('click', function(e) {
    crop_sprites = e_crop_sprites.checked;
  }, false);
  crop_sprites = e_crop_sprites.checked;
  var e_save_png = document.getElementById('save_png');
  e_save_png.addEventListener('click', function(e) {
    var a = document.createElement('a');
    var url = canvas.toDataURL();
    a.href = url;
    a.download = 'packed.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url);
    }, 0);
  }, false);
  var e_save_json = document.getElementById('save_json');
  e_save_json.addEventListener('click', function(e) {
    for (i in mega_json) {
      mega_json[i] = optimizeData(mega_json[i]);
    }
    var str = JSON.stringify(mega_json);
    str = str.slice(1, str.length-1); // cut off '{' and '}'
    var file = new Blob([str], {type: 'text/javascript'});
    var url = URL.createObjectURL(file);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'packed.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url);
    }, 0);

  }, false);

  var h_load_files = document.createElement('input');
  h_load_files.type = 'file';
  h_load_files.multiple = true;
  h_load_files.addEventListener('change', function(e) {
      loadFiles(e.target.files);
  });
  var e_load_files = document.getElementById('load');
  e_load_files.addEventListener('click', function() {
    h_load_files.click();
  });

}


