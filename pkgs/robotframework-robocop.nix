{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  hatchling,
  jinja2,
  robotframework,
  typer,
  rich,
  tomli,
  tomli-w,
  pathspec,
  platformdirs,
  pytz,
  msgpack,
  typing-extensions,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "8.2.7";
  pyproject = true;

  disabled = pythonOlder "3.10";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-PNg5eqQrY0WLcP6fr0gmsZ30a8Izb0PSZM2wonf3j5M=";
  };

  nativeBuildInputs = [
    hatchling
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer
    rich
    tomli
    tomli-w
    pathspec
    platformdirs
    pytz
    msgpack
    typing-extensions
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
