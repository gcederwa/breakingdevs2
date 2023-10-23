function initialize() {
    updateQueryString()
}    

function updateState(value) { 
    state = value 
    updateQueryString()
}

function updateSex(value)   { 
    sex = value 
    updateQueryString()
}

function updateYear(value)  { 
    year = value 
    updateQueryString()
}

function updateQueryString() {
    queryString = 

      "SELECT name, number, state, sex, year \n" 
    + "FROM   NamesNumberByStateYear \n"
    + "WHERE\n "
    + " state = "    + "'" + state   + "'"
    + " AND sex = "  + "'" + sex     + "'"
    + " AND year = " + "'" + year    + "'\n"
    + "ORDER BY number DESC LIMIT 5;"

    chartTitle = "Most Popular " + sex + " Names from " + state + " in " + year
    document.getElementById('queryStingId').innerHTML = queryString;
    
    runQuery()
}

function updateChart() {
    // update the charts names, numbers and title, then update it.
    myChart.data.labels             = names
    myChart.data.datasets[0].data   = numbers
    myChart.options.title.text      = chartTitle

    console.log(chartTitle)

    myChart.update()
}   

function runQuery() {
    MySql.Execute(
        "sql.wpc-is.online",	// mySQL server
        "demo", 				// login name
        "demo12345", 			// login password
        "BabyNames", 			// database to use
                                // SQL query string:
        queryString,
        function (data) {
            processQueryResult(data);
        }
    );
}

function processQueryResult(queryReturned) {
    if (!queryReturned.Success) {
        alert(queryReturned.Error)
    } else {
        // document.getElementById("output").innerHTML = 
        //     JSON.stringify(queryReturned.Result, null, 2);

        names = []
        numbers = []

        for (let i=0; i < queryReturned.Result.length;i++) {
            names.push(queryReturned.Result[i].name)
            numbers.push(queryReturned.Result[i].number)
        }

        console.log(names);
        console.log(numbers);

        updateChart()
    }
}