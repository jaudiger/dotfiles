{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "superhtml";
  version = "0.7.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "superhtml";
    rev = "v${finalAttrs.version}";
    hash = "sha256-bbRqwIdSNgHTNsPZzn+pf/9ix02rT3BXRB6uszaPdi4=";
  };

  zigDeps = zig_master.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-8m/NTh1ZDp8qM7VfdhVQv0fdzz6YpG7g4tSgsMSAEZ4=";
  };

  nativeBuildInputs = [ zig_master ];

  preConfigure = ''
    export ZIG_GLOBAL_CACHE_DIR="$TMPDIR/zig-global-cache"
    mkdir -p "$ZIG_GLOBAL_CACHE_DIR"
  '';

  postConfigure = ''
    ln -s ${finalAttrs.zigDeps} "$ZIG_GLOBAL_CACHE_DIR/p"
  '';

  buildPhase = ''
    runHook preBuild
    zig build "''${zigBuildFlags[@]}"
    runHook postBuild
  '';

  zigBuildFlags = [ "-Doptimize=ReleaseFast" ];

  installPhase = ''
    runHook preInstall
    install -Dm755 zig-out/bin/superhtml -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "HTML Language Server & Templating Language Library";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
