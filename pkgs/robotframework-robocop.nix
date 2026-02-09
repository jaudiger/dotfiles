{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  hatchling,
  jinja2,
  robotframework,
  typer-slim,
  rich,
  tomli,
  tomli-w,
  pathspec,
  platformdirs,
  pytz,
  msgpack,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "7.2.0";
  pyproject = true;

  disabled = pythonOlder "3.10";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-3FeHUNxbsCWVBlXE/IkWzUKUeBCzsQDKGSj7F+RX1TI=";
  };

  nativeBuildInputs = [
    hatchling
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer-slim
    rich
    tomli
    tomli-w
    pathspec
    platformdirs
    pytz
    msgpack
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
