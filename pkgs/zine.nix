{
  lib,
  stdenv,
  fetchFromGitHub,
  zig_master,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "zine";
  version = "0.12.0";

  src = fetchFromGitHub {
    owner = "kristoff-it";
    repo = "zine";
    rev = "v${finalAttrs.version}";
    hash = "sha256-GcrheiUUhQkmUY9Uy6poIM7t1/5zsNH/wWHjrN8/FFo=";
  };

  zigDeps = zig_master.fetchDeps {
    inherit (finalAttrs) src pname version;
    fetchAll = true;
    hash = "sha256-rnosrZgroQyBXzhhYIZpLjG5BCdHAuHzFCmjxixQdvY=";
  };

  nativeBuildInputs = [ zig_master ];

  preConfigure = ''
    export ZIG_GLOBAL_CACHE_DIR="$TMPDIR/zig-global-cache"
    mkdir -p "$ZIG_GLOBAL_CACHE_DIR"
  '';

  postPatch = ''
    # Patch build.zig to return a valid version when git is not available
    substituteInPlace build.zig --replace 'return .unknown;' "return .{ .tag = \"${finalAttrs.version}\" };"
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
    install -Dm755 zig-out/bin/zine -t "$out/bin"
    runHook postInstall
  '';

  meta = with lib; {
    description = "Fast, Scalable, Flexible Static Site Generator (SSG)";
    homepage = "https://zine-ssg.io";
    license = licenses.mit;
    maintainers = with maintainers; [ jaudiger ];
  };
})
